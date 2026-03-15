import * as z from "zod"
import { halfLifeDecay } from "@/infra/lib/math.ts"
import { createStateManager } from "@/infra/lib/state.ts"
import { elapsedMinutesSince, nowISO } from "@/infra/lib/time.ts"
import { DEFERRED_PROCESSING } from "./constants.ts"
import type { EmotionUpdateEvent } from "./types.ts"

export const DeferredCategory = z.enum([
  "delayed_realization",
  "deferred_apology",
  "delayed_humor",
  "retrospective_insight"
])
export type DeferredCategory = z.infer<typeof DeferredCategory>

export const DeferredEmotionalEvent = z.object({
  id: z.string(),
  content: z.string(),
  emotionalCharge: z.number().min(0).max(1),
  originalTrigger: z.string(),
  category: DeferredCategory,
  storedAt: z.string(),
  maturityThresholdHours: z.number(),
  matured: z.boolean().default(false)
})
export type DeferredEmotionalEvent = z.infer<typeof DeferredEmotionalEvent>

export const DeferredQueue = z.object({
  events: z.array(DeferredEmotionalEvent).default([]),
  lastCheckedAt: z.string().optional()
})
export type DeferredQueue = z.infer<typeof DeferredQueue>

const MATURITY_SCALES: Record<DeferredCategory, number> = {
  delayed_realization: DEFERRED_PROCESSING.REALIZATION_MATURITY_SCALE,
  deferred_apology: DEFERRED_PROCESSING.APOLOGY_MATURITY_SCALE,
  delayed_humor: DEFERRED_PROCESSING.HUMOR_MATURITY_SCALE,
  retrospective_insight: DEFERRED_PROCESSING.INSIGHT_MATURITY_SCALE
}

function computeMaturityThreshold(category: DeferredCategory, charge: number): number {
  const scale = MATURITY_SCALES[category]
  const base = DEFERRED_PROCESSING.MIN_MATURITY_HOURS
  const range = DEFERRED_PROCESSING.MAX_MATURITY_HOURS - base
  return base + range * scale * (1 - charge)
}

function inferCategory(trigger: string, intensity: number): DeferredCategory {
  if (trigger === "guardian_warning" || trigger === "boundary_violated") return "deferred_apology"
  if (trigger === "message_received" && intensity > 0.7) return "delayed_realization"
  if (trigger === "task_success" || trigger === "goal_completed") return "delayed_humor"
  return "retrospective_insight"
}

export function storeDeferredEvent(
  queue: DeferredQueue,
  trigger: string,
  intensity: number,
  detail?: string
): DeferredQueue {
  if (intensity < DEFERRED_PROCESSING.INTENSITY_THRESHOLD) return queue
  if (queue.events.length >= DEFERRED_PROCESSING.MAX_QUEUE_SIZE) {
    const minCharge = queue.events.reduce((min, e) => (e.emotionalCharge < min.emotionalCharge ? e : min))
    queue = { ...queue, events: queue.events.filter((e) => e.id !== minCharge.id) }
  }

  const category = inferCategory(trigger, intensity)
  const event: DeferredEmotionalEvent = {
    id: crypto.randomUUID(),
    content: detail ?? trigger,
    emotionalCharge: intensity,
    originalTrigger: trigger,
    category,
    storedAt: nowISO(),
    maturityThresholdHours: computeMaturityThreshold(category, intensity),
    matured: false
  }

  return { ...queue, events: [...queue.events, event] }
}

export function checkMaturedEvents(queue: DeferredQueue): {
  matured: DeferredEmotionalEvent[]
  updated: DeferredQueue
} {
  if (Math.random() >= DEFERRED_PROCESSING.MATURITY_CHECK_PROBABILITY) {
    return { matured: [], updated: { ...queue, lastCheckedAt: nowISO() } }
  }

  const now = nowISO()
  const matured: DeferredEmotionalEvent[] = []
  const remaining: DeferredEmotionalEvent[] = []

  for (const event of queue.events) {
    const hours = elapsedMinutesSince(event.storedAt) / 60
    if (hours >= event.maturityThresholdHours && !event.matured) {
      matured.push({ ...event, matured: true })
    } else {
      const decay = halfLifeDecay(hours, DEFERRED_PROCESSING.CHARGE_DECAY_HALF_LIFE_HOURS)
      const decayedCharge = event.emotionalCharge * decay
      if (decayedCharge >= DEFERRED_PROCESSING.MIN_CHARGE_TO_KEEP) {
        remaining.push({ ...event, emotionalCharge: decayedCharge })
      }
    }
  }

  return { matured, updated: { events: remaining, lastCheckedAt: now } }
}

export function maturedEventToTrigger(event: DeferredEmotionalEvent): EmotionUpdateEvent {
  const triggerMap: Record<DeferredCategory, string> = {
    delayed_realization: "nostalgia_wave",
    deferred_apology: "memory_contradiction",
    delayed_humor: "nostalgia_wave",
    retrospective_insight: "nostalgia_wave"
  }

  return {
    trigger: triggerMap[event.category] as EmotionUpdateEvent["trigger"],
    intensity: DEFERRED_PROCESSING.SURFACED_TRIGGER_INTENSITY,
    detail: event.content
  }
}

const defaultQueue: DeferredQueue = { events: [] }

export const { get: getDeferredQueue, save: saveDeferredQueue } = createStateManager(
  "working:emotion:deferred_queue",
  DeferredQueue,
  defaultQueue
)
