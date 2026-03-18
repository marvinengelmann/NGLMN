import type { EmotionalState } from "@/affect/emotion/types.ts"
import type { SomaticState } from "@/affect/soma/types.ts"
import { ATTENTION } from "./constants.ts"
import type { AttentionState } from "./types.ts"

/**
 * Compute the current attention state based on emotional, somatic, and contextual factors.
 */
export function computeAttentionState(
  emotion: EmotionalState,
  soma: SomaticState,
  hasMessages: boolean,
  consecutiveIdleTicks: number,
  conversationMessageCount = 0,
  consecutiveActiveTicks = 0
): AttentionState {
  if (emotion.curiosity > ATTENTION.HYPERFOCUS_CURIOSITY && emotion.energy > ATTENTION.HYPERFOCUS_ENERGY && hasMessages)
    return "hyperfocus"

  if (emotion.energy < ATTENTION.BLANK_ENERGY && soma.gravity > ATTENTION.BLANK_GRAVITY) return "blank"

  if (consecutiveActiveTicks > ATTENTION.FATIGUE_ONSET_TICKS && emotion.energy < ATTENTION.FATIGUE_DRIFT_ENERGY)
    return "drifting"

  if (
    emotion.boredom > ATTENTION.DRIFT_BOREDOM &&
    emotion.energy < ATTENTION.DRIFT_ENERGY &&
    consecutiveIdleTicks > ATTENTION.DRIFT_IDLE_TICKS
  )
    return "drifting"

  if (
    conversationMessageCount > ATTENTION.CONVERSATION_DRIFT_MIN_MESSAGES &&
    emotion.energy < ATTENTION.CONVERSATION_DRIFT_ENERGY &&
    emotion.boredom > ATTENTION.CONVERSATION_DRIFT_BOREDOM
  )
    return "drifting"

  return "focused"
}
