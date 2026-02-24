import { logAndCaptureError, trySafe } from "@/config/result-helpers.ts"
import { getEmotionalState, saveEmotionalState } from "@/emotion/state.ts"
import type { EmotionalState } from "@/emotion/types.ts"
import { computeEmotionalUpdate } from "@/emotion/update.ts"
import { log } from "@/lib/logger.ts"
import { setEmotionContext } from "@/lib/sentry.ts"
import { evaluatePerception } from "@/perception/evaluate.ts"
import { detectPerceptionGoals } from "@/perception/pattern-goals.ts"
import type { PerceptionSummary } from "@/perception/types.ts"

export interface TickContext {
  tickId: string
  startTime: number
  timestamp: string
}

export interface SenseResult {
  perception: PerceptionSummary
  emotion: EmotionalState
}

export async function sense(ctx: TickContext): Promise<SenseResult> {
  const perception = await evaluatePerception()
  log.info("Perception evaluated", {
    triggers: perception.emotionalTriggers.length,
    health: perception.ownState.healthStatus
  })

  const currentEmotion = await getEmotionalState()
  const allEmotionEvents = [{ trigger: "tick_start" as const, intensity: 0.5 }, ...perception.emotionalTriggers]
  const updatedEmotion = computeEmotionalUpdate(currentEmotion, allEmotionEvents)
  await saveEmotionalState(updatedEmotion, "tick_start", ctx.tickId)
  setEmotionContext(updatedEmotion)

  const goalsResult = await trySafe("PERCEPTION_ERROR", () => detectPerceptionGoals(perception, updatedEmotion))

  goalsResult.match(
    (goalsCreated) => {
      if (goalsCreated > 0) {
        log.info("Perception goals created", { count: goalsCreated })
      }
    },
    (error) => {
      logAndCaptureError(error, { phase: "perception_goals" })
    }
  )

  return { perception, emotion: updatedEmotion }
}
