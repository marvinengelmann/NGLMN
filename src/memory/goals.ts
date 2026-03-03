import { and, desc, eq, inArray } from "drizzle-orm"
import { EMOTIONAL_THRESHOLDS } from "@/config/constants.ts"
import type { AnimaDecision } from "@/consciousness/types.ts"
import { db } from "@/db/client.ts"
import type { GoalSelect } from "@/db/schema.ts"
import { goals } from "@/db/schema.ts"
import { processEmotionTrigger } from "@/emotion/state.ts"
import type { EmotionalState } from "@/emotion/types.ts"
import { log } from "@/lib/logger.ts"
import type { AnimaResultAsync } from "@/lib/result.ts"
import { trySafe } from "@/lib/result.ts"
import type { GoalSource } from "@/memory/types.ts"
import { GoalStatus } from "@/memory/types.ts"

const EMOTION_BOOST_FACTOR = 0.3

const SOURCE_EMOTION_MAP: Record<string, keyof EmotionalState> = {
  curiosity: "curiosity",
  dream: "excitement",
  self: "frustration",
  operator: "connection"
}

interface CreateGoalOptions {
  parentGoalId?: string
  emotionalWeight?: number
}

/**
 * Create a new goal.
 */
export function createGoal(
  title: string,
  description: string,
  source: GoalSource,
  priority: number = 0.5,
  options?: CreateGoalOptions
): AnimaResultAsync<string> {
  return trySafe("DB_ERROR", async () => {
    const rows = await db
      .insert(goals)
      .values({
        title,
        description,
        source,
        priority,
        parentGoalId: options?.parentGoalId,
        emotionalWeight: options?.emotionalWeight
      })
      .returning({ id: goals.id })

    const first = rows[0]
    if (!first) throw new Error("Expected row from goal creation")
    return first.id
  })
}

/**
 * Get all active/open goals.
 */
export async function getActiveGoals(): Promise<GoalSelect[]> {
  return db
    .select()
    .from(goals)
    .where(inArray(goals.status, ["open", "active"]))
    .orderBy(desc(goals.priority))
}

/**
 * Update a goal's status.
 */
export async function updateGoalStatus(id: string, status: GoalStatus): Promise<void> {
  const now = new Date()
  const isTerminal = status === "done" || status === "failed"

  await db
    .update(goals)
    .set({
      status,
      updatedAt: now,
      ...(isTerminal ? { completedAt: now } : {})
    })
    .where(eq(goals.id, id))
}

/**
 * Compute an effective score for a goal based on its priority and emotional state.
 */
export function computeEffectiveScore(goal: GoalSelect, emotion: EmotionalState): number {
  const priority = goal.priority ?? 0.5
  const weight = goal.emotionalWeight ?? 0.5
  const emotionKey = SOURCE_EMOTION_MAP[goal.source ?? "self"] ?? "frustration"
  const emotionValue = emotion[emotionKey]
  const bonus = emotionValue * weight * EMOTION_BOOST_FACTOR
  return priority + bonus
}

/**
 * Get top-N goals sorted by priority (highest first).
 * When emotion is provided, goals are scored with emotional weighting.
 */
export async function getGoalsByPriority(limit: number = 5, emotion?: EmotionalState): Promise<GoalSelect[]> {
  const query = db
    .select()
    .from(goals)
    .where(inArray(goals.status, ["open", "active"]))
    .orderBy(desc(goals.priority))

  if (!emotion) {
    return query.limit(limit)
  }

  const rows = await query.limit(Math.max(limit * 10, 50))
  return rows.sort((a, b) => computeEffectiveScore(b, emotion) - computeEffectiveScore(a, emotion)).slice(0, limit)
}

/**
 * Check if an active goal with the given title already exists.
 */
export async function goalExistsByTitle(title: string): Promise<boolean> {
  const rows = await db
    .select({ id: goals.id })
    .from(goals)
    .where(and(eq(goals.title, title), inArray(goals.status, ["open", "active"])))
    .limit(1)
  return rows.length > 0
}

/**
 * Execute a goal status update from ANIMA's decision, with emotion triggers for completion/failure.
 */
export async function executeGoalUpdate(decision: AnimaDecision): Promise<void> {
  const goalId = decision.actionPayload?.goalId
  const status = decision.actionPayload?.status
  if (!goalId || !status) return

  const parsed = GoalStatus.safeParse(status)
  if (!parsed.success) {
    log.warn("Invalid goal status from ANIMA", { goalId, status })
    return
  }

  await updateGoalStatus(goalId, parsed.data)
  log.info("Goal status updated", { goalId, status })

  if (parsed.data === "done") {
    await processEmotionTrigger(
      { trigger: "goal_completed", intensity: EMOTIONAL_THRESHOLDS.GOAL_COMPLETED_INTENSITY },
      "goal_completed"
    )
  } else if (parsed.data === "failed") {
    await processEmotionTrigger(
      { trigger: "goal_failed", intensity: EMOTIONAL_THRESHOLDS.GOAL_FAILED_INTENSITY },
      "goal_failed"
    )
  }
}
