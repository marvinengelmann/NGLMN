import { and, desc, eq, inArray } from "drizzle-orm"
import { TRIGGER_INTENSITY } from "@/affect/emotion/constants.ts"
import { processEmotionTrigger } from "@/affect/emotion/state.ts"
import type { EmotionalState } from "@/affect/emotion/types.ts"
import type { AnimaDecision } from "@/core/types.ts"
import { db } from "@/infra/db/client.ts"
import type { GoalSelect } from "@/infra/db/schema.ts"
import { goals } from "@/infra/db/schema.ts"
import { vectorIndex } from "@/infra/integrations/vector.ts"
import { log } from "@/infra/lib/logger.ts"
import type { AnimaResultAsync } from "@/infra/lib/result.ts"
import { trySafe } from "@/infra/lib/result.ts"
import { nowISO } from "@/infra/lib/time.ts"
import { recordEvent } from "@/memory/events.ts"
import { refreshGoalPriority } from "@/memory/goals/lifecycle.ts"
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

const GOAL_SIMILARITY_THRESHOLD = 0.85

/**
 * Create a new goal with semantic deduplication.
 * If a semantically similar active goal exists, merges by boosting priority instead.
 */
export function createGoal(
  title: string,
  description: string,
  source: GoalSource,
  priority: number = 0.5,
  options?: CreateGoalOptions
): AnimaResultAsync<string> {
  return trySafe("DB_ERROR", async () => {
    try {
      const similar = await vectorIndex.query({
        data: `${title} ${description}`,
        topK: 1,
        includeMetadata: true,
        filter: "category = 'task'"
      })

      const top = similar[0]
      if (top && top.score > GOAL_SIMILARITY_THRESHOLD && top.metadata?.tickId) {
        const existingGoalId = top.metadata.tickId
        const existing = await db.select().from(goals).where(eq(goals.id, existingGoalId)).limit(1)
        const existingGoal = existing[0]

        if (existingGoal && ["open", "active", "stale", "overdue"].includes(existingGoal.status ?? "")) {
          const boostedPriority = Math.min(1, (existingGoal.priority ?? 0.5) + priority * 0.3)
          await db
            .update(goals)
            .set({
              priority: boostedPriority,
              description: description || existingGoal.description,
              updatedAt: new Date()
            })
            .where(eq(goals.id, existingGoalId))

          log.info("Goal merged with existing", { existingId: existingGoalId, newPriority: boostedPriority })
          return existingGoalId
        }
      }
    } catch (e) {
      log.warn("Goal semantic dedup failed, creating normally", { error: String(e) })
    }

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

    try {
      await vectorIndex.upsert({
        id: `goal-${first.id}`,
        data: `${title} ${description}`,
        metadata: {
          category: "task",
          timestamp: nowISO(),
          relevanceScore: priority,
          tickId: first.id
        }
      })
    } catch (e) {
      log.warn("Goal vector upsert failed", { error: String(e) })
    }

    await recordEvent({ type: "goal_created", detail: title, metadata: { goalId: first.id, source } })

    return first.id
  })
}

/**
 * Get all active/open/stale/overdue goals.
 */
export async function getActiveGoals(): Promise<GoalSelect[]> {
  return db
    .select()
    .from(goals)
    .where(inArray(goals.status, ["open", "active", "stale", "overdue"]))
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
    .where(inArray(goals.status, ["open", "active", "stale", "overdue"]))
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
    .where(and(eq(goals.title, title), inArray(goals.status, ["open", "active", "stale", "overdue"])))
    .limit(1)
  return rows.length > 0
}

/**
 * Get child goals for a parent goal.
 */
export async function getChildGoals(parentGoalId: string): Promise<GoalSelect[]> {
  return db.select().from(goals).where(eq(goals.parentGoalId, parentGoalId)).orderBy(desc(goals.priority))
}

/**
 * Check if all child goals of a parent are completed.
 */
export async function checkParentGoalCompletion(parentGoalId: string): Promise<boolean> {
  const children = await getChildGoals(parentGoalId)
  if (children.length === 0) return false
  return children.every((c) => c.status === "done")
}

/**
 * Get goals with their sub-goal completion ratios, sorted by effective priority.
 */
export async function getGoalsWithSubGoalProgress(
  limit: number = 10
): Promise<Array<GoalSelect & { childProgress: number; childCount: number }>> {
  const topLevelGoals = await db
    .select()
    .from(goals)
    .where(inArray(goals.status, ["open", "active", "stale", "overdue"]))
    .orderBy(desc(goals.priority))
    .limit(limit)

  return Promise.all(
    topLevelGoals.map(async (goal) => {
      const children = await getChildGoals(goal.id)
      const doneCount = children.filter((c) => c.status === "done").length
      return {
        ...goal,
        childProgress: children.length > 0 ? doneCount / children.length : 0,
        childCount: children.length
      }
    })
  )
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

  if (parsed.data === "active") {
    await refreshGoalPriority(goalId)
  }

  if (parsed.data === "done") {
    await processEmotionTrigger(
      { trigger: "goal_completed", intensity: TRIGGER_INTENSITY.GOAL_COMPLETED },
      "goal_completed"
    )
    await recordEvent({ type: "goal_completed", metadata: { goalId } })

    const goal = await db.select().from(goals).where(eq(goals.id, goalId)).limit(1)
    const parentId = goal[0]?.parentGoalId
    if (parentId) {
      const allChildrenDone = await checkParentGoalCompletion(parentId)
      if (allChildrenDone) {
        await updateGoalStatus(parentId, "done")
        log.info("Parent goal auto-completed", { parentId })
        await processEmotionTrigger(
          { trigger: "goal_completed", intensity: TRIGGER_INTENSITY.GOAL_COMPLETED },
          "goal_completed"
        )
        await recordEvent({ type: "goal_completed", metadata: { goalId: parentId } })
      }
    }
  } else if (parsed.data === "failed") {
    await processEmotionTrigger({ trigger: "goal_failed", intensity: TRIGGER_INTENSITY.GOAL_FAILED }, "goal_failed")
    await recordEvent({ type: "goal_failed", metadata: { goalId } })
  }
}
