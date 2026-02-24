import { desc } from "drizzle-orm"
import { db } from "@/db/client.ts"
import { emotionHistory } from "@/db/schema.ts"
import { getCurrentEmotion, setCurrentEmotion } from "@/memory/working.ts"
import { getEmotionBaseline } from "@/personality/mbti.ts"
import type { EmotionTrigger } from "./types.ts"
import { EmotionalState } from "./types.ts"

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

  const baseline = getEmotionBaseline()
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
 * Get the last N emotion history entries from the database.
 */
export async function getEmotionHistory(limit: number = 10) {
  return db.select().from(emotionHistory).orderBy(desc(emotionHistory.createdAt)).limit(limit)
}
