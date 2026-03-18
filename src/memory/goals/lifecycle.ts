import { subDays } from "date-fns"
import { and, eq, inArray, lt, sql } from "drizzle-orm"
import { db } from "@/infra/db/client.ts"
import type { GoalSelect } from "@/infra/db/schema.ts"
import { goals } from "@/infra/db/schema.ts"
import { log } from "@/infra/lib/logger.ts"

const STALE_DAYS = 14
const SELF_HALF_LIFE_DAYS = 30
const OPERATOR_HALF_LIFE_DAYS = 60
const MIN_PRIORITY = 0.1
const PRIORITY_REFRESH_BOOST = 0.02

/**
 * Find goals that haven't been updated in STALE_DAYS.
 */
export async function detectStaleGoals(): Promise<GoalSelect[]> {
  const threshold = subDays(new Date(), STALE_DAYS)
  return db
    .select()
    .from(goals)
    .where(and(inArray(goals.status, ["open", "active"]), lt(goals.updatedAt, threshold)))
}

/**
 * Find goals past their deadline that aren't done/failed.
 */
export async function detectOverdueGoals(): Promise<GoalSelect[]> {
  return db
    .select()
    .from(goals)
    .where(and(inArray(goals.status, ["open", "active"]), lt(goals.deadline, new Date())))
}

/**
 * Mark a goal as stale.
 */
export async function markGoalStale(id: string): Promise<void> {
  await db.update(goals).set({ status: "stale", updatedAt: new Date() }).where(eq(goals.id, id))
  log.info("Goal marked stale", { goalId: id })
}

/**
 * Mark a goal as overdue.
 */
export async function markGoalOverdue(id: string): Promise<void> {
  await db.update(goals).set({ status: "overdue", updatedAt: new Date() }).where(eq(goals.id, id))
  log.info("Goal marked overdue", { goalId: id })
}

/**
 * Apply exponential priority decay to all active/open goals using half-life model.
 * Self-goals: 30-day half-life. Operator-goals: 60-day half-life (decay slower).
 * Formula: priority *= 0.5 ^ (1 / (halfLifeDays * 1440))
 */
export async function applyGoalPriorityDecay(): Promise<void> {
  const selfDecayFactor = 0.5 ** (1 / (SELF_HALF_LIFE_DAYS * 1440))
  await db
    .update(goals)
    .set({
      priority: sql`GREATEST(${MIN_PRIORITY}, COALESCE(${goals.priority}, 0.5) * ${selfDecayFactor})`
    })
    .where(and(inArray(goals.status, ["open", "active"]), eq(goals.source, "self")))

  const operatorDecayFactor = 0.5 ** (1 / (OPERATOR_HALF_LIFE_DAYS * 1440))
  await db
    .update(goals)
    .set({
      priority: sql`GREATEST(${MIN_PRIORITY}, COALESCE(${goals.priority}, 0.5) * ${operatorDecayFactor})`
    })
    .where(and(inArray(goals.status, ["open", "active"]), eq(goals.source, "operator")))
}

/**
 * Refresh a goal's priority when it appears in deliberation context.
 */
export async function refreshGoalPriority(goalId: string): Promise<void> {
  await db
    .update(goals)
    .set({
      priority: sql`LEAST(1, COALESCE(${goals.priority}, 0.5) + ${PRIORITY_REFRESH_BOOST})`,
      updatedAt: new Date()
    })
    .where(eq(goals.id, goalId))
}
