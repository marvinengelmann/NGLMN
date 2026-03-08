import { desc } from "drizzle-orm"
import * as z from "zod"
import { db } from "@/db/client.ts"
import { emotionHistory } from "@/db/schema.ts"
import { getValidatedRedisOr, redis } from "@/integrations/redis.ts"
import { getCurrentEmotion, setCurrentEmotion } from "@/memory/working.ts"
import {
  AfterglowEntry,
  DEFAULT_EMOTIONAL_MOMENTUM,
  DEFAULT_EMOTIONAL_STATE,
  EmotionalMomentum,
  EmotionalState,
  type EmotionTrigger,
  type EmotionUpdateEvent
} from "./types.ts"
import { getGenesisDNA } from "@/genesis/state.ts"
import { computeEmotionalUpdate } from "./update.ts"

const MOMENTUM_KEYS = {
  MOMENTUM: "working:emotion:momentum",
  AFTERGLOW: "working:emotion:afterglow",
  MOOD_BASELINE: "working:emotion:moodBaseline"
} as const

/**
 * Get the current emotional state. Redis-first, DB-fallback, DEFAULT fallback.
 */
export async function getEmotionalState(): Promise<EmotionalState> {
  const cached = await getCurrentEmotion()
  if (cached) return cached

  const rows = await db.select().from(emotionHistory).orderBy(desc(emotionHistory.createdAt)).limit(1)

  if (rows.length > 0) {
    const state = EmotionalState.parse(rows[0]?.state)
    await setCurrentEmotion(state)
    return state
  }

  const dna = await getGenesisDNA()
  const baseline = dna?.emotionalBaseline ?? DEFAULT_EMOTIONAL_STATE
  await setCurrentEmotion(baseline)
  return baseline
}

/**
 * Save the emotional state to both Redis (fast) and DB (persistent).
 */
export async function saveEmotionalState(
  state: EmotionalState,
  trigger: EmotionTrigger,
  tickId?: string
): Promise<void> {
  await Promise.all([
    setCurrentEmotion(state),
    db.insert(emotionHistory).values({
      state,
      trigger,
      tickId: tickId ?? null
    })
  ])
}

/**
 * Emit one or more emotion events: get → compute → save in one step.
 */
export async function processEmotionTrigger(
  events: EmotionUpdateEvent | EmotionUpdateEvent[],
  trigger: EmotionTrigger,
  tickId?: string
): Promise<EmotionalState> {
  const current = await getEmotionalState()
  const updated = computeEmotionalUpdate(current, Array.isArray(events) ? events : [events])
  await saveEmotionalState(updated, trigger, tickId)
  return updated
}

/**
 * Get the last N emotion history entries from the database.
 */
export async function getEmotionHistory(limit: number = 10) {
  return db.select().from(emotionHistory).orderBy(desc(emotionHistory.createdAt)).limit(limit)
}

export async function getEmotionalMomentum(): Promise<EmotionalMomentum> {
  return getValidatedRedisOr(MOMENTUM_KEYS.MOMENTUM, EmotionalMomentum, DEFAULT_EMOTIONAL_MOMENTUM)
}

export async function saveEmotionalMomentum(momentum: EmotionalMomentum): Promise<void> {
  await redis.set(MOMENTUM_KEYS.MOMENTUM, momentum)
}

export async function getAfterglowEntries(): Promise<AfterglowEntry[]> {
  return getValidatedRedisOr(MOMENTUM_KEYS.AFTERGLOW, z.array(AfterglowEntry), [])
}

export async function saveAfterglowEntries(entries: AfterglowEntry[]): Promise<void> {
  await redis.set(MOMENTUM_KEYS.AFTERGLOW, entries)
}

export async function getMoodBaseline(): Promise<EmotionalState> {
  return getValidatedRedisOr(MOMENTUM_KEYS.MOOD_BASELINE, EmotionalState, DEFAULT_EMOTIONAL_STATE)
}

export async function saveMoodBaseline(baseline: EmotionalState): Promise<void> {
  await redis.set(MOMENTUM_KEYS.MOOD_BASELINE, baseline)
}
