import { getHours } from "date-fns"
import { HEARTBEAT_GATING, LIFECYCLE } from "@/config/constants.ts"
import type { EmotionalState } from "@/emotion/types.ts"
import { redis } from "@/integrations/redis.ts"
import { clamp01 } from "@/lib/math.ts"
import { nowLocal } from "@/lib/time.ts"
import { getDriftThrottle } from "@/memory/working.ts"
import { isDreamDue } from "./lifecycle.ts"

const BURST_COOLDOWN_KEY = "working:gating:burstCooldown"

/**
 * Record that an active tick just happened (with messages sent), triggering burst cooldown.
 */
export async function recordActiveTick(): Promise<void> {
  const cooldownTicks = LIFECYCLE.BURST_COOLDOWN_TICKS + Math.floor(Math.random() * 3)
  await redis.set(BURST_COOLDOWN_KEY, cooldownTicks, { ex: cooldownTicks * 90 })
}

/**
 * Compute time-of-day skip modulation.
 * Returns 0 at night when a dream is due so the heartbeat isn't skipped.
 */
async function getTimeOfDayModulation(): Promise<number> {
  const hour = getHours(nowLocal())

  if (hour >= 1 && hour < 6) {
    if (await isDreamDue()) return 0
    return 0.4
  }
  if (hour >= 7 && hour < 9) return -0.1
  if (hour >= 14 && hour < 16) return 0.15

  return 0
}

/**
 * Compute the probability that a heartbeat tick should be skipped.
 * Active conversations and pending messages always prevent skipping.
 * Includes time-of-day modulation and burst cooldown.
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

  raw += await getTimeOfDayModulation()

  const cooldown = await redis.get(BURST_COOLDOWN_KEY)
  if (cooldown != null) {
    raw += LIFECYCLE.BURST_COOLDOWN_SKIP_BOOST
    const remaining = Number(cooldown)
    if (remaining > 1) {
      await redis.set(BURST_COOLDOWN_KEY, remaining - 1, { ex: (remaining - 1) * 90 })
    } else {
      await redis.del(BURST_COOLDOWN_KEY)
    }
  }

  const throttle = await getDriftThrottle()
  if (throttle === "high") raw += 0.6
  else if (throttle === "medium") raw += 0.3

  return clamp01(Math.min(raw, HEARTBEAT_GATING.MAX_SKIP))
}
