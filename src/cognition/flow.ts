import { ATTENTION } from "@/config/constants.ts"
import type { EmotionalState } from "@/emotion/types.ts"
import type { SomaticState } from "@/soma/types.ts"
import type { AttentionState } from "./types.ts"

/**
 * Compute the current attention state based on emotional, somatic, and contextual factors.
 */
export function computeAttentionState(
  emotion: EmotionalState,
  soma: SomaticState,
  hasMessages: boolean,
  consecutiveIdleTicks: number,
  conversationMessageCount = 0
): AttentionState {
  if (emotion.curiosity > ATTENTION.HYPERFOCUS_CURIOSITY && emotion.energy > ATTENTION.HYPERFOCUS_ENERGY && hasMessages)
    return "hyperfocus"

  if (emotion.energy < ATTENTION.BLANK_ENERGY && soma.gravity > ATTENTION.BLANK_GRAVITY) return "blank"

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
