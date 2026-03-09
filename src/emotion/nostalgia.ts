import { differenceInDays, parseISO } from "date-fns"
import { clamp01 } from "@/lib/math.ts"
import type { EmotionUpdateEvent } from "./types.ts"

export const NOSTALGIA = {
  AGE_THRESHOLD_DAYS: 7,
  BASE_PROBABILITY: 0.15,
  AGE_SCALE_DAYS: 30,
  MAX_PROBABILITY: 0.4,
  INTENSITY: 0.5
} as const

/**
 * Detect nostalgia from old episodic memories surfacing during recall.
 * Returns an emotion event if nostalgia is probabilistically triggered.
 */
export function detectNostalgia(
  episodes: Array<{ metadata?: { timestamp: string; relevanceScore: number } }>,
  now: Date
): EmotionUpdateEvent | null {
  const oldEpisodes = episodes.filter((ep) => {
    if (!ep.metadata?.timestamp) return false
    try {
      return differenceInDays(now, parseISO(ep.metadata.timestamp)) > NOSTALGIA.AGE_THRESHOLD_DAYS
    } catch {
      return false
    }
  })

  if (oldEpisodes.length === 0) return null

  const avgAgeDays =
    oldEpisodes.reduce((sum, ep) => {
      return sum + differenceInDays(now, parseISO(ep.metadata?.timestamp ?? now.toISOString()))
    }, 0) / oldEpisodes.length

  const probability = clamp01(
    Math.min(NOSTALGIA.BASE_PROBABILITY + (avgAgeDays / NOSTALGIA.AGE_SCALE_DAYS) * 0.1, NOSTALGIA.MAX_PROBABILITY)
  )

  if (Math.random() >= probability) return null

  return { trigger: "nostalgia_wave", intensity: NOSTALGIA.INTENSITY }
}
