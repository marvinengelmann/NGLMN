import { desc } from "drizzle-orm"
import { db } from "@/db/client.ts"
import { emotionHistory } from "@/db/schema.ts"
import { getCurrentEmotion, setCurrentEmotion } from "@/memory/working.ts"
import { DEFAULT_EMOTIONAL_STATE, EmotionalState, type EmotionTrigger, type EmotionUpdateEvent } from "./types.ts"
import { computeEmotionalUpdate } from "./update.ts"

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

  await setCurrentEmotion(DEFAULT_EMOTIONAL_STATE)
  return DEFAULT_EMOTIONAL_STATE
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
