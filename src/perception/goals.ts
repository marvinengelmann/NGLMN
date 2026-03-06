import { PERCEPTION, TRIGGER_INTENSITY } from "@/config/constants.ts"
import { processEmotionTrigger } from "@/emotion/state.ts"
import type { EmotionalState } from "@/emotion/types.ts"
import { redis } from "@/integrations/redis.ts"
import { logAndCaptureError } from "@/lib/result.ts"
import { createGoal, goalExistsByTitle } from "@/memory/goals.ts"
import type { PerceptionSummary } from "@/perception/types.ts"

const FREQUENCY_KEY = "working:perception:lastGoalCheck"

interface PatternGoal {
  title: string
  description: string
  priority: number
  emotionalWeight: number
}

/**
 * Detect significant patterns in perception data and create goals when warranted.
 * Rate-limited to once per hour via Redis TTL key.
 */
export async function detectPerceptionGoals(perception: PerceptionSummary, _emotion: EmotionalState): Promise<number> {
  const lastCheck = await redis.get(FREQUENCY_KEY)
  if (lastCheck) return 0

  await redis.set(FREQUENCY_KEY, "1", { ex: PERCEPTION.GOAL_CHECK_TTL_SECONDS })

  const patterns = detectPatterns(perception)
  let goalsCreated = 0

  for (const pattern of patterns) {
    const exists = await goalExistsByTitle(pattern.title)
    if (exists) continue

    const goalResult = await createGoal(pattern.title, pattern.description, "self", pattern.priority, {
      emotionalWeight: pattern.emotionalWeight
    })
    if (goalResult.isErr()) {
      logAndCaptureError(goalResult.error)
      continue
    }
    goalsCreated++
  }

  if (goalsCreated > 0) {
    await processEmotionTrigger(
      { trigger: "new_goal", intensity: TRIGGER_INTENSITY.NEW_GOAL },
      "new_goal",
      `perception-goals-${Date.now()}`
    )
  }

  return goalsCreated
}

/**
 * Analyze perception data and return goal definitions for detected patterns.
 */
export function detectPatterns(perception: PerceptionSummary): PatternGoal[] {
  const patterns: PatternGoal[] = []

  if (perception.telegramActivity.lastMessageAge > 86400 && !perception.telegramActivity.operatorActive) {
    patterns.push({
      title: "Reconnect with operator",
      description: "Operator has been silent for over 24 hours. Consider reaching out proactively.",
      priority: 0.7,
      emotionalWeight: 0.8
    })
  }

  if (perception.ownState.budgetPercent > 85) {
    patterns.push({
      title: "Optimize resource usage",
      description: `Budget usage at ${perception.ownState.budgetPercent.toFixed(0)}%. Review model tier usage and reduce costs.`,
      priority: 0.8,
      emotionalWeight: 0.6
    })
  }

  if (perception.gitActivity && perception.gitActivity.externalCommitCount >= 3) {
    patterns.push({
      title: "Review recent external changes",
      description: `${perception.gitActivity.externalCommitCount} external commits detected. Review changes for context awareness.`,
      priority: 0.5,
      emotionalWeight: 0.5
    })
  }

  if (perception.ownState.healthStatus === "degraded" && perception.ownState.errorCount >= 3) {
    patterns.push({
      title: "Investigate system health issues",
      description: `System is degraded with ${perception.ownState.errorCount} errors. Diagnose and resolve issues.`,
      priority: 0.9,
      emotionalWeight: 0.7
    })
  }

  return patterns
}
