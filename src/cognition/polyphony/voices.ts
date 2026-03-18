import type { EmotionalState } from "@/affect/emotion/types.ts"
import type { BigFive } from "@/self/genesis/types.ts"
import { getDominanceHistory } from "./state.ts"
import type { InnerVoice } from "./types.ts"

interface VoiceContext {
  dissonanceScore: number
  action: string
  hasMessages: boolean
}

/**
 * Select 2-4 active competing goal-directed systems based on emotion, personality, and context.
 */
export function selectActiveVoices(
  emotion: EmotionalState,
  bigFive: BigFive,
  context: VoiceContext,
  alteredVoiceModifiers?: Partial<Record<InnerVoice, number>>
): InnerVoice[] {
  const scores: Record<InnerVoice, number> = {
    novelty_seeking: 0,
    threat_avoidance: 0,
    social_bonding: 0,
    cognitive_control: 0,
    play_system: 0,
    monitoring: 0
  }

  if (emotion.curiosity > 0.6) scores.novelty_seeking += 0.5
  if (!context.hasMessages && emotion.boredom > 0.5) scores.novelty_seeking += 0.3

  if (emotion.caution > 0.6) scores.threat_avoidance += 0.5
  if (context.dissonanceScore > 0.5) scores.threat_avoidance += 0.3

  const emotionValues = Object.values(emotion)
  if (emotionValues.some((v) => v > 0.7) || emotionValues.some((v) => v < 0.3)) {
    scores.social_bonding += 0.5
  }

  if (emotion.confidence > 0.6) scores.cognitive_control += 0.3

  if (emotion.excitement > 0.6) scores.play_system += 0.4
  if (emotion.boredom > 0.7) scores.play_system += 0.3

  if (context.dissonanceScore > 0.3) scores.monitoring += 0.6

  const bigFiveWeights = getBigFiveWeights(bigFive)
  for (const [voice, bonus] of Object.entries(bigFiveWeights)) {
    scores[voice as InnerVoice] += bonus
  }

  if (alteredVoiceModifiers) {
    for (const [voice, bonus] of Object.entries(alteredVoiceModifiers)) {
      scores[voice as InnerVoice] += bonus
    }
  }

  const sorted = (Object.entries(scores) as [InnerVoice, number][])
    .sort((a, b) => b[1] - a[1])
    .filter(([, score]) => score > 0.1)
    .map(([voice]) => voice)

  if (sorted.length < 2) {
    const defaults: InnerVoice[] = ["monitoring", "social_bonding", "cognitive_control", "novelty_seeking"]
    defaults.find((d) => {
      if (!sorted.includes(d)) sorted.push(d)
      return sorted.length >= 2
    })
  }

  return sorted.slice(0, 4)
}

const DOMINANCE_FREQUENCY_BOOST = 0.1

/**
 * Get a frequency-based boost for voices that have recently been dominant.
 */
export async function getVoiceDominanceBoost(): Promise<Partial<Record<InnerVoice, number>>> {
  const history = await getDominanceHistory()

  if (history.length === 0) return {}

  const counts = history.reduce<Partial<Record<InnerVoice, number>>>((acc, voice) => {
    acc[voice] = (acc[voice] ?? 0) + 1
    return acc
  }, {})

  const maxCount = Math.max(...Object.values(counts))
  const boost = Object.entries(counts).reduce<Partial<Record<InnerVoice, number>>>((acc, [voice, count]) => {
    acc[voice as InnerVoice] = (count / maxCount) * DOMINANCE_FREQUENCY_BOOST
    return acc
  }, {})

  return boost
}

function getBigFiveWeights(bigFive: BigFive): Partial<Record<InnerVoice, number>> {
  return {
    novelty_seeking: bigFive.openness * 0.3,
    social_bonding: (bigFive.extraversion + bigFive.agreeableness) * 0.15,
    cognitive_control: bigFive.conscientiousness * 0.25,
    threat_avoidance: bigFive.conscientiousness * 0.15 + bigFive.neuroticism * 0.2,
    play_system: bigFive.openness * 0.15 + bigFive.agreeableness * 0.1,
    monitoring: bigFive.neuroticism * 0.25
  }
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
