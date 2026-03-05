import { HEARTBEAT_GATING } from "@/config/constants.ts"
import type { EmotionalState } from "@/emotion/types.ts"
import { clamp01 } from "@/lib/math.ts"
import { getDriftThrottle } from "@/memory/working.ts"

/**
 * Compute the probability that a heartbeat tick should be skipped.
 * Active conversations and pending messages always prevent skipping.
 * Drift throttle increases skip probability to protect system stability.
 */
export async function computeSkipProbability(
  emotion: EmotionalState,
  inConversation: boolean,
  hasMessages: boolean
): Promise<number> {
  if (inConversation || hasMessages) return 0

  let raw =
    HEARTBEAT_GATING.BASE +
    emotion.energy * HEARTBEAT_GATING.ENERGY_WEIGHT +
    emotion.boredom * HEARTBEAT_GATING.BOREDOM_WEIGHT +
    emotion.excitement * HEARTBEAT_GATING.EXCITEMENT_WEIGHT +
    emotion.connection * HEARTBEAT_GATING.CONNECTION_WEIGHT

  const throttle = await getDriftThrottle()
  if (throttle === "high") raw += 0.6
  else if (throttle === "medium") raw += 0.3

  return clamp01(Math.min(raw, HEARTBEAT_GATING.MAX_SKIP))
}
