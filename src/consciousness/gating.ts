import { HEARTBEAT_GATING } from "@/config/constants.ts"
import type { EmotionalState } from "@/emotion/types.ts"
import { clamp01 } from "@/lib/math.ts"

/**
 * Compute the probability that a heartbeat tick should be skipped.
 * Active conversations and pending messages always prevent skipping.
 */
export function computeSkipProbability(emotion: EmotionalState, inConversation: boolean, hasMessages: boolean): number {
  if (inConversation || hasMessages) return 0

  const raw =
    HEARTBEAT_GATING.BASE +
    emotion.energy * HEARTBEAT_GATING.ENERGY_WEIGHT +
    emotion.boredom * HEARTBEAT_GATING.BOREDOM_WEIGHT +
    emotion.excitement * HEARTBEAT_GATING.EXCITEMENT_WEIGHT +
    emotion.connection * HEARTBEAT_GATING.CONNECTION_WEIGHT

  return clamp01(Math.min(raw, HEARTBEAT_GATING.MAX_SKIP))
}
