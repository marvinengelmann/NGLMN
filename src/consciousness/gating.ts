import { getHours } from "date-fns"
import type { EmotionalState } from "@/affect/emotion/types.ts"
import { redis } from "@/infra/integrations/redis.ts"
import { clamp01 } from "@/infra/lib/math.ts"
import { nowLocal } from "@/infra/lib/time.ts"
import { getDriftThrottle } from "@/memory/working.ts"
import { LIFECYCLE } from "@/self/constants.ts"
import { isDreamDue } from "@/self/lifecycle.ts"
import { HEARTBEAT_GATING } from "./constants.ts"

const BURST_COOLDOWN_KEY = "working:gating:burstCooldown"
const SECONDS_PER_TICK = 90

const TIME_MODULATION = {
  NIGHT_START: 0,
  NIGHT_END: 6,
  NIGHT_SKIP: 0.4,
  MORNING_START: 7,
  MORNING_END: 9,
  MORNING_BOOST: -0.1,
  AFTERNOON_START: 14,
  AFTERNOON_END: 16,
  AFTERNOON_SKIP: 0.15
} as const

const DRIFT_THROTTLE = {
  HIGH_BOOST: 0.6,
  MEDIUM_BOOST: 0.3
} as const

/**
 * Record that an active tick just happened (with messages sent), triggering burst cooldown.
 */
export async function recordActiveTick(): Promise<void> {
  const cooldownTicks = LIFECYCLE.BURST_COOLDOWN_TICKS + Math.floor(Math.random() * LIFECYCLE.BURST_COOLDOWN_JITTER)
  await redis.set(BURST_COOLDOWN_KEY, cooldownTicks, { ex: cooldownTicks * SECONDS_PER_TICK })
}

/**
 * Compute time-of-day skip modulation.
 * Returns 0 at night when a dream is due so the heartbeat isn't skipped.
 */
async function getTimeOfDayModulation(): Promise<number> {
  const hour = getHours(nowLocal())

  if (hour >= TIME_MODULATION.NIGHT_START && hour < TIME_MODULATION.NIGHT_END) {
    if (await isDreamDue()) return 0
    return TIME_MODULATION.NIGHT_SKIP
  }
  if (hour >= TIME_MODULATION.MORNING_START && hour < TIME_MODULATION.MORNING_END) return TIME_MODULATION.MORNING_BOOST
  if (hour >= TIME_MODULATION.AFTERNOON_START && hour < TIME_MODULATION.AFTERNOON_END)
    return TIME_MODULATION.AFTERNOON_SKIP

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
  }

  const throttle = await getDriftThrottle()
  if (throttle === "high") raw += DRIFT_THROTTLE.HIGH_BOOST
  else if (throttle === "medium") raw += DRIFT_THROTTLE.MEDIUM_BOOST

  return clamp01(Math.min(raw, HEARTBEAT_GATING.MAX_SKIP))
}

/**
 * Consume one burst cooldown tick. Call only when a heartbeat is actually skipped.
 */
export async function consumeBurstCooldownTick(): Promise<void> {
  const cooldown = await redis.get(BURST_COOLDOWN_KEY)
  if (cooldown == null) return
  const remaining = Number(cooldown)
  if (remaining > 1) {
    await redis.set(BURST_COOLDOWN_KEY, remaining - 1, { ex: (remaining - 1) * SECONDS_PER_TICK })
  } else {
    await redis.del(BURST_COOLDOWN_KEY)
  }
}
