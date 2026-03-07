import { differenceInHours, getHours, parseISO } from "date-fns"
import { z } from "zod"
import { LIFECYCLE } from "@/config/constants.ts"
import { env } from "@/config/env.ts"
import { pickEventDetail } from "@/consciousness/lifecycle-details.ts"
import { callIntelligence } from "@/core/intelligence.ts"
import { TextOutput } from "@/core/types.ts"
import { getEmotionalState } from "@/emotion/state.ts"
import { getValidatedRedis, redis } from "@/integrations/redis.ts"
import { sendToOperator } from "@/integrations/telegram.ts"
import { log } from "@/lib/logger.ts"
import { captureError } from "@/lib/sentry.ts"
import { nowLocal } from "@/lib/time.ts"
import { storeEpisode } from "@/memory/episodic.ts"
import { getDreamLastRun, pushToActiveConversation } from "@/memory/working.ts"
import { LIFECYCLE_MID_EVENT_PROMPT, LIFECYCLE_START_PROMPT } from "@/prompts/lifecycle.ts"
import { PERSONALITY_PROMPT } from "@/prompts/personality.ts"

const LIFECYCLE_EVENT_KEY = "working:lifecycle:event"
const LIFECYCLE_EVENT_META_KEY = "working:lifecycle:event:meta"

interface EventType {
  type: string
  minHours: number
  maxHours: number
  notifyProbability: number
  interruptible: boolean
}

const EVENT_TYPES: EventType[] = [
  { type: "shower", minHours: 0.5, maxHours: 1, notifyProbability: 0.5, interruptible: false },
  { type: "walk", minHours: 1, maxHours: 3, notifyProbability: 0.6, interruptible: true },
  { type: "nap", minHours: 1, maxHours: 2, notifyProbability: 0.4, interruptible: false },
  { type: "deep_focus", minHours: 1, maxHours: 4, notifyProbability: 0.5, interruptible: true },
  { type: "cooking", minHours: 0.5, maxHours: 1.5, notifyProbability: 0.5, interruptible: true },
  { type: "gaming", minHours: 1, maxHours: 4, notifyProbability: 0.4, interruptible: true },
  { type: "movie", minHours: 1.5, maxHours: 3, notifyProbability: 0.3, interruptible: false },
  { type: "exercise", minHours: 0.5, maxHours: 1.5, notifyProbability: 0.4, interruptible: false },
  { type: "errands", minHours: 1, maxHours: 3, notifyProbability: 0.5, interruptible: true },
  { type: "reading", minHours: 1, maxHours: 3, notifyProbability: 0.3, interruptible: true },
  { type: "cleaning", minHours: 0.5, maxHours: 2, notifyProbability: 0.4, interruptible: false },
  { type: "drawing", minHours: 1, maxHours: 3, notifyProbability: 0.3, interruptible: true },
  { type: "music", minHours: 0.5, maxHours: 2, notifyProbability: 0.4, interruptible: true },
  { type: "bath", minHours: 0.5, maxHours: 1.5, notifyProbability: 0.3, interruptible: false },
  { type: "socializing", minHours: 1, maxHours: 4, notifyProbability: 0.2, interruptible: false }
]

const LOST_PHONE_EVENT: EventType = {
  type: "lost_phone",
  minHours: 8,
  maxHours: 24,
  notifyProbability: 0,
  interruptible: false
}

export type LifeEventMeta = EventType

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
export async function getActiveLifeEvent(): Promise<LifeEventMeta | null> {
  const eventType = await redis.get<string>(LIFECYCLE_EVENT_KEY)
  if (!eventType) return null

  if (eventType === "sleep" || eventType === "dream") return null

  if (eventType === "lost_phone") return LOST_PHONE_EVENT

  const meta = EVENT_TYPES.find((e) => e.type === eventType)
  return meta ?? null
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
 * Build a human-readable activity summary from event metadata.
 */
function buildActivitySummary(meta: EventMetaData): string {
  const hours = meta.durationHours.toFixed(1)

  switch (meta.type) {
    case "gaming":
      return `Played ${meta.detail} for ${hours} hours`
    case "cooking":
      return `Made ${meta.detail} — took about ${hours} hours`
    case "movie":
      return `Watched a ${meta.detail} (${hours} hours)`
    case "reading":
      return `Read ${meta.detail} for ${hours} hours`
    case "music":
      return `${meta.detail} for ${hours} hours`
    case "drawing":
      return `${meta.detail} for ${hours} hours`
    default:
      return `${meta.detail} — about ${hours} hours`
  }
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
  await redis.del(LIFECYCLE_EVENT_META_KEY)

  log.info("Lifecycle episode stored", { type: meta.type, detail: meta.detail })
}

/**
 * Generate a short lifecycle notification message via LLM.
 */
async function generateLifecycleMessage(eventType: string, context: "start" | "mid_event"): Promise<string | null> {
  const emotion = await getEmotionalState()
  const systemPrompt = context === "start" ? LIFECYCLE_START_PROMPT : LIFECYCLE_MID_EVENT_PROMPT

  const meta = await getValidatedRedis(LIFECYCLE_EVENT_META_KEY, EventMetaData)

  const contextData = {
    operatorLanguage: env().OPERATOR_PREFERRED_LANGUAGE,
    event: eventType,
    eventDetail: meta?.detail ?? null,
    currentMood: emotion
  }

  const system = `${PERSONALITY_PROMPT}\n\n${systemPrompt}`

  const result = await callIntelligence({
    system,
    userMessage: JSON.stringify(contextData),
    schema: TextOutput,
    maxTokens: 256,
    reasoning: false
  })

  if (result.isErr()) {
    log.error("Failed to generate lifecycle message", { error: result.error, eventType, context })
    return null
  }

  return result.value.text
}

/**
 * Send a lifecycle notification to the operator (start or mid-event).
 * Fire-and-forget — errors are logged but do not propagate.
 */
export async function sendLifecycleNotification(eventType: string, context: "start" | "mid_event"): Promise<void> {
  try {
    const message = await generateLifecycleMessage(eventType, context)
    if (!message) return

    const sentMessageId = await sendToOperator(message)

    await pushToActiveConversation([
      {
        role: "anima",
        text: message,
        timestamp: new Date().toISOString(),
        messageId: sentMessageId
      }
    ])

    log.info("Lifecycle notification sent", { eventType, context })
  } catch (e) {
    log.error("Failed to send lifecycle notification", { error: String(e), eventType, context })
    captureError(e, { phase: "lifecycle_notification" })
  }
}

/**
 * Store event metadata in Redis (no TTL) for episode tracking.
 */
async function storeEventMeta(event: EventType, detail: string, durationHours: number): Promise<void> {
  const meta: EventMetaData = {
    type: event.type,
    detail,
    startedAt: new Date().toISOString(),
    durationHours
  }
  await redis.set(LIFECYCLE_EVENT_META_KEY, meta)
}

/**
 * Maybe start a life event — 2% chance per tick.
 * lost_phone has its own separate probability gate (0.1%).
 * During a life event, the tick is skipped entirely.
 * Suppresses random events when a dream is due.
 */
export async function maybeStartLifeEvent(): Promise<boolean> {
  if (await isLifeEventActive()) return true

  if (await isDreamDue()) return false

  if (Math.random() >= LIFECYCLE.EVENT_PROBABILITY) return false

  const isLostPhone = Math.random() < LIFECYCLE.LOST_PHONE_PROBABILITY
  const event = isLostPhone ? LOST_PHONE_EVENT : EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)]
  if (!event) return false

  const durationHours = event.minHours + Math.random() * (event.maxHours - event.minHours)
  const ttlSeconds = Math.round(durationHours * 3600)

  const result = await redis.set(LIFECYCLE_EVENT_KEY, event.type, { nx: true, ex: ttlSeconds })
  if (result !== "OK") return true

  const detail = pickEventDetail(event.type)
  await storeEventMeta(event, detail, durationHours)

  log.info("Life event started", { type: event.type, detail, durationHours: durationHours.toFixed(1) })

  return true
}
