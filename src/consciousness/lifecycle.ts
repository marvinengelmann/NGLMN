import { LIFECYCLE } from "@/config/constants.ts"
import { redis } from "@/integrations/redis.ts"
import { log } from "@/lib/logger.ts"

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
 * Maybe start a life event — 2% chance per tick.
 * During a life event, the tick is skipped entirely.
 */
export async function maybeStartLifeEvent(): Promise<boolean> {
  if (await isLifeEventActive()) return true

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
