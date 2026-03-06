import { differenceInHours, getHours, parseISO } from "date-fns"
import { LIFECYCLE } from "@/config/constants.ts"
import { redis } from "@/integrations/redis.ts"
import { log } from "@/lib/logger.ts"
import { nowLocal } from "@/lib/time.ts"
import { getDreamLastRun } from "@/memory/working.ts"

const LIFECYCLE_EVENT_KEY = "working:lifecycle:event"

const EVENT_TYPES = [
  { type: "shower", minHours: 0.5, maxHours: 1 },
  { type: "walk", minHours: 1, maxHours: 3 },
  { type: "nap", minHours: 1, maxHours: 2 },
  { type: "lost_phone", minHours: 2, maxHours: 4 },
  { type: "deep_focus", minHours: 1, maxHours: 4 }
] as const

/**
 * Check if a life event is currently active.
 */
export async function isLifeEventActive(): Promise<boolean> {
  const event = await redis.get(LIFECYCLE_EVENT_KEY)
  return event != null
}

/**
 * Check if a dream is due: night window + last dream was >DREAM_COOLDOWN_HOURS ago.
 */
export async function isDreamDue(): Promise<boolean> {
  const hour = getHours(nowLocal())
  if (hour < LIFECYCLE.DREAM_WINDOW_START || hour >= LIFECYCLE.DREAM_WINDOW_END) return false

  const lastRun = await getDreamLastRun()
  if (!lastRun) return true

  return differenceInHours(new Date(), parseISO(lastRun)) >= LIFECYCLE.DREAM_COOLDOWN_HOURS
}

/**
 * Start a sleep lifecycle event after dreaming. Blocks heartbeat for 5-7h.
 */
export async function startSleepEvent(): Promise<void> {
  const durationHours =
    LIFECYCLE.SLEEP_MIN_HOURS + Math.random() * (LIFECYCLE.SLEEP_MAX_HOURS - LIFECYCLE.SLEEP_MIN_HOURS)
  const ttlSeconds = Math.round(durationHours * 3600)

  await redis.set(LIFECYCLE_EVENT_KEY, "sleep", { ex: ttlSeconds })
  log.info("Sleep event started", { durationHours: durationHours.toFixed(1) })
}

/**
 * Maybe start a life event — 2% chance per tick.
 * During a life event, the tick is skipped entirely.
 * Suppresses random events when a dream is due.
 */
export async function maybeStartLifeEvent(): Promise<boolean> {
  if (await isLifeEventActive()) return true

  if (await isDreamDue()) return false

  if (Math.random() >= LIFECYCLE.EVENT_PROBABILITY) return false

  const event = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)]
  if (!event) return false

  const durationHours = event.minHours + Math.random() * (event.maxHours - event.minHours)
  const ttlSeconds = Math.round(durationHours * 3600)

  const result = await redis.set(LIFECYCLE_EVENT_KEY, event.type, { nx: true, ex: ttlSeconds })
  if (result !== "OK") return true

  log.info("Life event started", { type: event.type, durationHours: durationHours.toFixed(1) })

  return true
}
