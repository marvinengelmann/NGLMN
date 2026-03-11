import { subDays } from "date-fns"
import { and, eq, inArray, lt, sql } from "drizzle-orm"
import { db } from "@/infra/db/client.ts"
import type { GoalSelect } from "@/infra/db/schema.ts"
import { goals } from "@/infra/db/schema.ts"
import { log } from "@/infra/lib/logger.ts"

const STALE_DAYS = 14
const PRIORITY_DECAY_PER_DAY = 0.01
const OPERATOR_DECAY_FACTOR = 0.5
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
 * Apply priority decay to all active/open goals. 1 tick = ~1 minute.
 */
export async function applyGoalPriorityDecay(): Promise<void> {
  const decayPerTick = PRIORITY_DECAY_PER_DAY / 1440

  await db
    .update(goals)
    .set({
      priority: sql`GREATEST(${MIN_PRIORITY}, COALESCE(${goals.priority}, 0.5) - ${decayPerTick})`
    })
    .where(and(inArray(goals.status, ["open", "active"]), eq(goals.source, "self")))

  const operatorDecay = decayPerTick * OPERATOR_DECAY_FACTOR
  await db
    .update(goals)
    .set({
      priority: sql`GREATEST(${MIN_PRIORITY}, COALESCE(${goals.priority}, 0.5) - ${operatorDecay})`
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
