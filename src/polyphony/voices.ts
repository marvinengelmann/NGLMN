import type { EmotionalState } from "@/emotion/types.ts"
import { redis } from "@/integrations/redis.ts"
import type { PersonalityType } from "@/personality/types.ts"
import { InnerVoice } from "./types.ts"

interface VoiceContext {
  dissonanceScore: number
  action: string
  hasMessages: boolean
}

/**
 * Select 2-4 active inner voices based on emotion, personality, and context.
 */
export function selectActiveVoices(
  emotion: EmotionalState,
  personality: PersonalityType,
  context: VoiceContext
): InnerVoice[] {
  const scores: Record<InnerVoice, number> = {
    explorer: 0,
    guardian: 0,
    feeler: 0,
    analyst: 0,
    child: 0,
    observer: 0
  }

  if (emotion.curiosity > 0.6) scores.explorer += 0.5
  if (!context.hasMessages && emotion.boredom > 0.5) scores.explorer += 0.3

  if (emotion.caution > 0.6) scores.guardian += 0.5
  if (context.dissonanceScore > 0.5) scores.guardian += 0.3

  const emotionValues = Object.values(emotion)
  if (emotionValues.some((v) => v > 0.7) || emotionValues.some((v) => v < 0.3)) {
    scores.feeler += 0.5
  }

  if (emotion.confidence > 0.6) scores.analyst += 0.3

  if (emotion.excitement > 0.6) scores.child += 0.4
  if (emotion.boredom > 0.7) scores.child += 0.3

  if (context.dissonanceScore > 0.3) scores.observer += 0.6

  const mbtiWeights = getMbtiWeights(personality)
  for (const [voice, bonus] of Object.entries(mbtiWeights)) {
    scores[voice as InnerVoice] += bonus
  }

  const sorted = (Object.entries(scores) as [InnerVoice, number][])
    .sort((a, b) => b[1] - a[1])
    .filter(([, score]) => score > 0.1)
    .map(([voice]) => voice)

  if (sorted.length < 2) {
    const defaults: InnerVoice[] = ["observer", "feeler", "analyst", "explorer"]
    for (const d of defaults) {
      if (!sorted.includes(d)) sorted.push(d)
      if (sorted.length >= 2) break
    }
  }

  return sorted.slice(0, 4)
}

const DOMINANCE_HISTORY_KEY = "working:polyphony:voiceDominanceHistory"
const DOMINANCE_FREQUENCY_BOOST = 0.1

/**
 * Get a frequency-based boost for voices that have recently been dominant.
 */
export async function getVoiceDominanceBoost(): Promise<Partial<Record<InnerVoice, number>>> {
  const raw = await redis.lrange(DOMINANCE_HISTORY_KEY, 0, -1)
  const history = raw
    .map((v) => InnerVoice.safeParse(v))
    .filter((r) => r.success)
    .map((r) => r.data)

  if (history.length === 0) return {}

  const counts: Partial<Record<InnerVoice, number>> = {}
  for (const voice of history) {
    counts[voice] = (counts[voice] ?? 0) + 1
  }

  const maxCount = Math.max(...Object.values(counts))
  const boost: Partial<Record<InnerVoice, number>> = {}
  for (const [voice, count] of Object.entries(counts)) {
    boost[voice as InnerVoice] = (count / maxCount) * DOMINANCE_FREQUENCY_BOOST
  }

  return boost
}

function getMbtiWeights(personality: PersonalityType): Partial<Record<InnerVoice, number>> {
  const isNT = personality[1] === "N" && personality[2] === "T"
  const isNF = personality[1] === "N" && personality[2] === "F"
  const isSF = personality[1] === "S" && personality[2] === "F"
  const isST = personality[1] === "S" && personality[2] === "T"

  if (isNT) return { analyst: 0.3, explorer: 0.2 }
  if (isNF) return { feeler: 0.3, explorer: 0.2 }
  if (isSF) return { feeler: 0.2, child: 0.2 }
  if (isST) return { analyst: 0.2, guardian: 0.2 }
  return {}
}

/**
 * Relevance gate — should the inner dialog run this tick?
 */
export function shouldRunDialog(
  emotion: EmotionalState,
  hasMessages: boolean,
  dissonanceScore: number,
  action: string
): boolean {
  if (hasMessages) return true
  if (dissonanceScore > 0.3) return true
  if (action !== "idle") return true

  const values = Object.values(emotion)
  if (values.some((v) => v > 0.7) || values.some((v) => v < 0.3)) return true

  return false
}
