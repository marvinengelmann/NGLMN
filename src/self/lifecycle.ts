import { differenceInHours, getDay, getHours, parseISO } from "date-fns"
import { z } from "zod"
import { getDreamLastRun } from "@/expression/dream/state.ts"
import { getValidatedRedis, redis } from "@/infra/integrations/redis.ts"
import { log } from "@/infra/lib/logger.ts"
import { nowISO, nowLocal } from "@/infra/lib/time.ts"
import { storeEpisode } from "@/memory/episodic.ts"
import { recordEvent } from "@/memory/events.ts"
import { setBotStatus } from "@/infra/integrations/telegram.ts"
import { computePostHaircutLength } from "@/self/appearance/compute.ts"
import { getAppearanceState, saveAppearanceState } from "@/self/appearance/state.ts"
import { getGenesisName } from "@/self/genesis/state.ts"
import { LIFECYCLE } from "./constants.ts"

const LIFECYCLE_EVENT_KEY = "working:lifecycle:event"
const LIFECYCLE_EVENT_META_KEY = "working:lifecycle:event:meta"
const LIFECYCLE_LAST_ROLLED_KEY = "working:lifecycle:lastRolledUpdateId"
const LIFECYCLE_HISTORY_KEY = "working:lifecycle:history"

export interface EventType {
  type: string
  minHours: number
  maxHours: number
  notifyProbability: number
  availableHours?: [number, number]
  weekendOnly?: boolean
}

const EVENT_TYPES: EventType[] = [
  { type: "sleep", minHours: 5, maxHours: 7, notifyProbability: 0.03, availableHours: [22, 7] },
  { type: "shower", minHours: 0.15, maxHours: 0.4, notifyProbability: 0.05, availableHours: [6, 23] },
  { type: "nap", minHours: 0.5, maxHours: 1.5, notifyProbability: 0.1, availableHours: [12, 18] },
  { type: "meditation", minHours: 0.15, maxHours: 0.75, notifyProbability: 0.08, availableHours: [5, 22] },
  { type: "swimming", minHours: 0.5, maxHours: 1.5, notifyProbability: 0.15, availableHours: [7, 21] },
  { type: "driving", minHours: 0.25, maxHours: 1.5, notifyProbability: 0.15, availableHours: [7, 23] },
  { type: "concert", minHours: 1.5, maxHours: 3.5, notifyProbability: 0.3, availableHours: [18, 2] },
  { type: "yoga", minHours: 0.5, maxHours: 1.25, notifyProbability: 0.15, availableHours: [6, 20] },
  { type: "gym", minHours: 0.75, maxHours: 1.75, notifyProbability: 0.6, availableHours: [6, 22] },
  { type: "running", minHours: 0.25, maxHours: 1, notifyProbability: 0.15, availableHours: [5, 21] },
  { type: "cycling", minHours: 0.5, maxHours: 1.5, notifyProbability: 0.15, availableHours: [6, 20] },
  { type: "exercise", minHours: 0.5, maxHours: 1.25, notifyProbability: 0.55, availableHours: [6, 22] },
  { type: "deep_focus", minHours: 0.75, maxHours: 2.5, notifyProbability: 0.35, availableHours: [8, 22] },
  { type: "movie", minHours: 1.5, maxHours: 2.5, notifyProbability: 0.3, availableHours: [14, 2] },
  { type: "socializing", minHours: 1, maxHours: 3, notifyProbability: 0.4, availableHours: [10, 2] },
  { type: "board_games", minHours: 1, maxHours: 2.5, notifyProbability: 0.4, availableHours: [16, 1] },
  { type: "phone_call", minHours: 0.15, maxHours: 1, notifyProbability: 0.1, availableHours: [9, 23] },
  { type: "volunteering", minHours: 1, maxHours: 3, notifyProbability: 0.3, availableHours: [8, 18] },
  { type: "drawing", minHours: 0.5, maxHours: 2, notifyProbability: 0.5, availableHours: [8, 2] },
  { type: "writing", minHours: 0.5, maxHours: 2, notifyProbability: 0.45, availableHours: [7, 2] },
  { type: "crafting", minHours: 0.5, maxHours: 2, notifyProbability: 0.5, availableHours: [10, 22] },
  { type: "photography", minHours: 0.5, maxHours: 2, notifyProbability: 0.5, availableHours: [7, 19] },
  { type: "gaming", minHours: 0.5, maxHours: 3, notifyProbability: 0.5, availableHours: [10, 4] },
  { type: "hiking", minHours: 1, maxHours: 3.5, notifyProbability: 0.35, availableHours: [7, 17] },
  { type: "studying", minHours: 0.5, maxHours: 1.5, notifyProbability: 0.6, availableHours: [8, 21] },
  { type: "cleaning", minHours: 0.5, maxHours: 1.5, notifyProbability: 0.65, availableHours: [8, 20] },
  { type: "cooking", minHours: 0.25, maxHours: 1.25, notifyProbability: 0.6, availableHours: [10, 22] },
  { type: "journaling", minHours: 0.15, maxHours: 0.75, notifyProbability: 0.4, availableHours: [6, 1] },
  { type: "reading", minHours: 0.5, maxHours: 2, notifyProbability: 0.5 },
  { type: "walk", minHours: 0.25, maxHours: 1.25, notifyProbability: 0.65, availableHours: [6, 22] },
  { type: "errands", minHours: 0.5, maxHours: 1.5, notifyProbability: 0.7, availableHours: [8, 19] },
  { type: "grocery_shopping", minHours: 0.25, maxHours: 1, notifyProbability: 0.7, availableHours: [8, 21] },
  { type: "shopping", minHours: 0.5, maxHours: 2, notifyProbability: 0.7, availableHours: [10, 21] },
  { type: "eating_out", minHours: 0.75, maxHours: 1.75, notifyProbability: 0.55, availableHours: [11, 23] },
  { type: "skincare", minHours: 0.1, maxHours: 0.35, notifyProbability: 0.5, availableHours: [6, 23] },
  { type: "haircut", minHours: 0.5, maxHours: 1.5, notifyProbability: 0.7, availableHours: [9, 19] },
  { type: "doctor_visit", minHours: 0.5, maxHours: 2, notifyProbability: 0.7, availableHours: [8, 18] },
  { type: "streaming", minHours: 0.5, maxHours: 2.5, notifyProbability: 0.7, availableHours: [12, 4] },
  { type: "podcast", minHours: 0.25, maxHours: 1.5, notifyProbability: 0.65 },
  { type: "music", minHours: 0.25, maxHours: 1.5, notifyProbability: 0.75 },
  { type: "bath", minHours: 0.5, maxHours: 1, notifyProbability: 0.7, availableHours: [18, 1] },
  { type: "laundry", minHours: 0.25, maxHours: 0.75, notifyProbability: 0.75, availableHours: [8, 22] },
  { type: "commuting", minHours: 0.25, maxHours: 1, notifyProbability: 0.65, availableHours: [6, 20] },
  { type: "picnic", minHours: 1, maxHours: 2.5, notifyProbability: 0.5, availableHours: [10, 18] },
  { type: "party", minHours: 2, maxHours: 5, notifyProbability: 0.25, availableHours: [20, 5], weekendOnly: true },
  { type: "bar_with_friends", minHours: 1.5, maxHours: 3.5, notifyProbability: 0.3, availableHours: [18, 3] }
]

export function getEventMeta(type: string): EventType | undefined {
  return EVENT_TYPES.find((e) => e.type === type)
}

function isHourInRange(hour: number, range: [number, number]): boolean {
  const [start, end] = range
  if (start < end) {
    return hour >= start && hour < end
  }
  return hour >= start || hour < end
}

const LifeEventHistoryEntry = z.object({
  type: z.string(),
  startedAt: z.string()
})

async function getLifeEventHistory(): Promise<z.infer<typeof LifeEventHistoryEntry>[]> {
  const raw = await redis.lrange(LIFECYCLE_HISTORY_KEY, 0, LIFECYCLE.EVENT_HISTORY_SIZE - 1)
  return raw
    .map((entry) => {
      const parsed = LifeEventHistoryEntry.safeParse(typeof entry === "string" ? JSON.parse(entry) : entry)
      return parsed.success ? parsed.data : null
    })
    .filter((e): e is z.infer<typeof LifeEventHistoryEntry> => e != null)
}

async function pushLifeEventHistory(type: string): Promise<void> {
  const entry: z.infer<typeof LifeEventHistoryEntry> = { type, startedAt: nowISO() }
  await redis.lpush(LIFECYCLE_HISTORY_KEY, JSON.stringify(entry))
  await redis.ltrim(LIFECYCLE_HISTORY_KEY, 0, LIFECYCLE.EVENT_HISTORY_SIZE - 1)
}

interface AvailableLifeEventsOptions {
  operatorSilenceMinutes: number
  hasNewCommits: boolean
}

/**
 * Get life events available at the current time of day and day of week,
 * filtered by cooldowns, conversation guard, and data validation.
 */
export async function getAvailableLifeEvents(options: AvailableLifeEventsOptions): Promise<EventType[]> {
  if (options.operatorSilenceMinutes < LIFECYCLE.CONVERSATION_GUARD_MINUTES) {
    return []
  }

  const now = nowLocal()
  const hour = getHours(now)
  const day = getDay(now)
  const isWeekend = day === 0 || day === 6

  const history = await getLifeEventHistory()
  const cooldownCutoff = new Date(Date.now() - LIFECYCLE.EVENT_COOLDOWN_HOURS * 3600 * 1000)
  const recentTypes = new Set(history.filter((e) => parseISO(e.startedAt) > cooldownCutoff).map((e) => e.type))

  return EVENT_TYPES.filter((event) => {
    if (event.weekendOnly && !isWeekend) return false
    if (event.availableHours && !isHourInRange(hour, event.availableHours)) return false
    if (recentTypes.has(event.type)) return false
    return true
  })
}

const EventMetaData = z.object({
  type: z.string(),
  detail: z.string(),
  startedAt: z.string(),
  durationHours: z.number()
})
type EventMetaData = z.infer<typeof EventMetaData>

/**
 * Check if a life event is currently active.
 */
export async function isLifeEventActive(): Promise<boolean> {
  const event = await redis.get(LIFECYCLE_EVENT_KEY)
  return event != null
}

/**
 * Get the active life event with its full metadata, or null if none is active.
 */
export async function getActiveLifeEvent(): Promise<EventType | null> {
  const eventType = await redis.get<string>(LIFECYCLE_EVENT_KEY)
  if (!eventType) return null

  if (eventType === "dream") return null

  return EVENT_TYPES.find((e) => e.type === eventType) ?? null
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
  await Promise.all([
    recordEvent({ type: "sleep_started", metadata: { durationHours } }),
    setBotStatus("sleeping 💤")
  ])
  log.info("Sleep event started", { durationHours: durationHours.toFixed(1) })
}

/**
 * Build a human-readable activity summary from event metadata.
 */
function buildActivitySummary(meta: EventMetaData): string {
  const hours = meta.durationHours.toFixed(1)
  return `${meta.detail} (${hours}h)`
}

/**
 * Store a lifecycle episode if an event just ended (meta exists but no active event).
 */
export async function maybeStoreLifecycleEpisode(): Promise<void> {
  if (await isLifeEventActive()) return

  const meta = await getValidatedRedis(LIFECYCLE_EVENT_META_KEY, EventMetaData)
  if (!meta) return

  const summary = buildActivitySummary(meta)
  await storeEpisode(summary, "activity", { relevanceScore: 0.6 })
  await recordEvent({
    type: "lifecycle_ended",
    detail: meta.detail,
    metadata: { eventType: meta.type, durationHours: meta.durationHours }
  })
  await redis.del(LIFECYCLE_EVENT_META_KEY)
  await redis.del(LIFECYCLE_LAST_ROLLED_KEY)

  const name = await getGenesisName()
  await setBotStatus(name)

  if (meta.type === "haircut") {
    await applyHaircutToAppearance()
  }

  log.info("Lifecycle episode stored", { type: meta.type, detail: meta.detail })
}

async function applyHaircutToAppearance(): Promise<void> {
  const appearance = await getAppearanceState()
  const newLength = computePostHaircutLength(appearance.hairLengthCm)
  await saveAppearanceState({
    ...appearance,
    hairLengthCm: newLength,
    lastHaircutAt: new Date().toISOString()
  })
  log.info("Haircut applied to appearance", { oldLength: appearance.hairLengthCm, newLength })
}

/**
 * Roll the probability gate for mid-event phone check.
 * Returns true if ANIMA "noticed" the notification (probability passed).
 * Ensures each message batch is only rolled once.
 */
export async function rollMidEventNotification(event: EventType, maxUpdateId: number | null): Promise<boolean> {
  if (maxUpdateId == null) return false

  const lastRolled = await redis.get<number>(LIFECYCLE_LAST_ROLLED_KEY)
  if (lastRolled != null && maxUpdateId <= lastRolled) {
    return false
  }

  if (Math.random() >= event.notifyProbability) {
    log.info("Mid-event phone check skipped — probability gate", {
      type: event.type,
      probability: event.notifyProbability
    })
    return false
  }

  await redis.set(LIFECYCLE_LAST_ROLLED_KEY, maxUpdateId)
  log.info("Mid-event phone check passed", { type: event.type, probability: event.notifyProbability })
  return true
}

export interface ActiveLifeEventMeta {
  type: string
  detail: string
  startedAt: string
  durationHours: number
}

/**
 * Get the metadata of the currently active life event, or null if none.
 */
export async function getActiveLifeEventMeta(): Promise<ActiveLifeEventMeta | null> {
  if (!(await isLifeEventActive())) return null
  return getValidatedRedis(LIFECYCLE_EVENT_META_KEY, EventMetaData)
}

/**
 * Store event metadata in Redis (no TTL) for episode tracking.
 */
async function storeEventMeta(event: EventType, detail: string, durationHours: number): Promise<void> {
  const meta: EventMetaData = {
    type: event.type,
    detail,
    startedAt: nowISO(),
    durationHours
  }
  await redis.set(LIFECYCLE_EVENT_META_KEY, meta)
}

/**
 * Start a life event chosen by the LLM during the DELIBERATE step.
 */
export async function startChosenLifeEvent(type: string, detail?: string, chosenDurationHours?: number): Promise<void> {
  if (await isLifeEventActive()) return

  const event = EVENT_TYPES.find((e) => e.type === type)
  if (!event) {
    log.warn("Unknown life event type", { type })
    return
  }

  const durationHours =
    chosenDurationHours != null && chosenDurationHours > 0
      ? Math.max(event.minHours, Math.min(event.maxHours, chosenDurationHours))
      : event.minHours + Math.random() * (event.maxHours - event.minHours)
  const ttlSeconds = Math.round(durationHours * 3600)

  const result = await redis.set(LIFECYCLE_EVENT_KEY, event.type, { nx: true, ex: ttlSeconds })
  if (result !== "OK") return

  const resolvedDetail = detail ?? event.type
  await Promise.all([
    storeEventMeta(event, resolvedDetail, durationHours),
    pushLifeEventHistory(event.type),
    recordEvent({
      type: "lifecycle_started",
      detail: resolvedDetail,
      metadata: { eventType: event.type, durationHours }
    }),
    setBotStatus(resolvedDetail)
  ])

  log.info("Life event started", { type: event.type, detail: resolvedDetail, durationHours: durationHours.toFixed(1) })
}
