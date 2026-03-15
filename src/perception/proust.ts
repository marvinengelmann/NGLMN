import type { EmotionalState } from "@/affect/emotion/types.ts"
import { PROUST } from "./constants.ts"

export interface ProustFlashback {
  episodeContent: string
  originalValence: number
  emotionSpike: Partial<Record<keyof EmotionalState, number>>
}

interface EpisodicHit {
  id?: string
  score?: number
  data?: string
  metadata?: {
    valence?: number
    emotionalState?: string
    timestamp?: string
    relevanceScore?: number
  }
}

export function detectProustFlashback(episodes: EpisodicHit[]): ProustFlashback | null {
  const candidates = episodes
    .filter((ep) => {
      const score = ep.score ?? 0
      const valence = ep.metadata?.valence ?? 0
      return score >= PROUST.MIN_SCORE && Math.abs(valence) >= PROUST.MIN_VALENCE_MAGNITUDE && ep.data
    })
    .sort((a, b) => {
      const scoreA = (a.score ?? 0) * Math.abs(a.metadata?.valence ?? 0)
      const scoreB = (b.score ?? 0) * Math.abs(b.metadata?.valence ?? 0)
      return scoreB - scoreA
    })

  if (candidates.length === 0) return null

  const top = candidates[0]
  if (!top?.data) return null
  if (Math.random() >= PROUST.FLASHBACK_PROBABILITY) return null

  const valence = top.metadata?.valence ?? 0
  const magnitude = Math.abs(valence) * PROUST.SPIKE_SCALE

  const emotionSpike: Partial<Record<keyof EmotionalState, number>> =
    valence > 0
      ? Object.fromEntries(Object.entries(PROUST.EMOTION_SPIKE_POSITIVE).map(([k, v]) => [k, v * magnitude]))
      : Object.fromEntries(Object.entries(PROUST.EMOTION_SPIKE_NEGATIVE).map(([k, v]) => [k, v * magnitude]))

  return {
    episodeContent: top.data,
    originalValence: valence,
    emotionSpike
  }
}
