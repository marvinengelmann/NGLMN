import { parseISO } from "date-fns"
import { desc } from "drizzle-orm"
import * as z from "zod"
import { db } from "@/infra/db/client.ts"
import { emotionHistory } from "@/infra/db/schema.ts"
import { getValidatedRedis, getValidatedRedisOr, redis } from "@/infra/integrations/redis.ts"
import { log } from "@/infra/lib/logger.ts"
import { zodParse } from "@/infra/lib/result.ts"
import { getGenesisDNA } from "@/self/genesis/state.ts"
import { createNeutralAppraisalContext } from "./appraisal.ts"
import {
  AfterglowEntry,
  DEFAULT_EMOTIONAL_MOMENTUM,
  DEFAULT_EMOTIONAL_STATE,
  EmotionalMomentum,
  EmotionalState,
  type EmotionTrigger,
  type EmotionUpdateEvent
} from "./types.ts"
import { computeEmotionalUpdate, enforceEmotionFloors } from "./update.ts"

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
    const parsed = zodParse(EmotionalState, rows[0]?.state, "EMOTION_ERROR")
    if (parsed.isOk()) {
      await setCurrentEmotion(parsed.value)
      return parsed.value
    }
    log.warn("Invalid emotional state in DB, falling back to genesis default", { error: parsed.error.message })
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
  const eventArray = Array.isArray(events) ? events : [events]
  const defaultMoodContext = {
    operatorSilenceMinutes: 0,
    inConversation: false,
    systemHealthy: true,
    budgetOk: true,
    hasActiveGoals: false,
    isDreaming: false,
    operatorMood: "unknown" as const,
    connectionLevel: 0.5,
    attachmentAvoidance: 0.15
  }
  const result = computeEmotionalUpdate(
    current,
    eventArray,
    defaultMoodContext,
    1,
    {},
    {
      appraisalContext: createNeutralAppraisalContext()
    }
  )
  const updated = enforceEmotionFloors(result.state)
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

export async function getAfterglowEntries(): Promise<AfterglowEntry[]> {
  return getValidatedRedisOr(MOMENTUM_KEYS.AFTERGLOW, z.array(AfterglowEntry), [])
}

export async function getMoodBaseline(): Promise<EmotionalState> {
  return getValidatedRedisOr(MOMENTUM_KEYS.MOOD_BASELINE, EmotionalState, DEFAULT_EMOTIONAL_STATE)
}

const WORKING_KEYS = {
  EMOTION_CURRENT: "working:emotion:current",
  EMOTION_TRIGGER_TIMESTAMPS: "working:emotion:triggerTimestamps",
  EMOTION_LAST_TIMESTAMP: "working:emotion:lastTimestamp"
} as const

export async function getCurrentEmotion(): Promise<EmotionalState | null> {
  return getValidatedRedis(WORKING_KEYS.EMOTION_CURRENT, EmotionalState)
}

export async function setCurrentEmotion(state: EmotionalState): Promise<void> {
  await redis.set(WORKING_KEYS.EMOTION_CURRENT, state)
}

export async function getRawTriggerTimestamps(): Promise<Record<string, string>> {
  return (await redis.get<Record<string, string>>(WORKING_KEYS.EMOTION_TRIGGER_TIMESTAMPS)) ?? {}
}

export async function getTriggerTimestamps(): Promise<Record<string, number>> {
  const raw = await redis.get<Record<string, string>>(WORKING_KEYS.EMOTION_TRIGGER_TIMESTAMPS)
  if (!raw) return {}
  return Object.fromEntries(
    Object.entries(raw).map(([trigger, isoTimestamp]) => [
      trigger,
      (Date.now() - parseISO(isoTimestamp).getTime()) / 60000
    ])
  )
}

export async function getLastEmotionTimestamp(): Promise<string | null> {
  return redis.get<string>(WORKING_KEYS.EMOTION_LAST_TIMESTAMP)
}
