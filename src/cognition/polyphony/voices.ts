import type { EmotionalState } from "@/affect/emotion/types.ts"
import type { BigFive } from "@/self/genesis/types.ts"
import { getDominanceHistory } from "./state.ts"
import type { InnerVoice } from "./types.ts"

interface VoiceContext {
  dissonanceScore: number
  action: string
  hasMessages: boolean
}

const ALL_VOICES: InnerVoice[] = ["seeking", "fear", "care", "executive", "play", "monitoring"]

/**
 * Select 2-4 active competing goal-directed systems based on emotion, personality, and context.
 * Grounded in Panksepp's affective neuroscience with switchboard-inspired diversity mechanism.
 */
export function selectActiveVoices(
  emotion: EmotionalState,
  bigFive: BigFive,
  context: VoiceContext,
  alteredVoiceModifiers?: Partial<Record<InnerVoice, number>>
): InnerVoice[] {
  const scores: Record<InnerVoice, number> = {
    seeking: 0,
    fear: 0,
    care: 0,
    executive: 0,
    play: 0,
    monitoring: 0
  }

  if (emotion.curiosity > 0.6) scores.seeking += 0.5
  if (!context.hasMessages && emotion.boredom > 0.5) scores.seeking += 0.3

  if (emotion.caution > 0.6) scores.fear += 0.5
  if (context.dissonanceScore > 0.5) scores.fear += 0.3

  const emotionValues = Object.values(emotion)
  if (emotionValues.some((v) => v > 0.7) || emotionValues.some((v) => v < 0.3)) {
    scores.care += 0.5
  }

  if (emotion.confidence > 0.6) scores.executive += 0.3

  if (emotion.excitement > 0.6) scores.play += 0.4
  if (emotion.boredom > 0.7) scores.play += 0.3

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
    const defaults: InnerVoice[] = ["monitoring", "care", "executive", "seeking"]
    defaults.find((d) => {
      if (!sorted.includes(d)) sorted.push(d)
      return sorted.length >= 2
    })
  }

  return sorted.slice(0, 4)
}

const NOVELTY_BOOST_MAX = 0.2
const PERSEVERATION_PENALTY_MAX = 0.25

/**
 * Compute switchboard modifiers inspired by the median raphe nucleus mechanism (Nature 2025):
 * - Voices that have been UNDER-represented get a novelty boost (exploration signal)
 * - The currently perseverating voice gets a penalty that grows with consecutive dominance
 * - Norepinephrine level scales the switching intensity (Aston-Jones & Cohen, 2005)
 *
 * High NE → strong switching pressure (exploration mode)
 * Low NE → weak switching pressure (exploitation mode)
 */
export async function computeSwitchboardModifiers(
  norepinephrineLevel: number
): Promise<Partial<Record<InnerVoice, number>>> {
  const history = await getDominanceHistory()

  if (history.length < 3) return {}

  const counts = history.reduce<Record<InnerVoice, number>>(
    (acc, voice) => {
      acc[voice] += 1
      return acc
    },
    { seeking: 0, fear: 0, care: 0, executive: 0, play: 0, monitoring: 0 }
  )

  const total = history.length
  const switchingGain = Math.max(0.2, norepinephrineLevel)

  const consecutiveDominance = countConsecutiveLeader(history)
  const perseverationPenalty =
    Math.min(PERSEVERATION_PENALTY_MAX, (consecutiveDominance / total) * PERSEVERATION_PENALTY_MAX * 2) * switchingGain

  const modifiers: Partial<Record<InnerVoice, number>> = {}

  for (const voice of ALL_VOICES) {
    const frequency = counts[voice] / total
    const underRepresentation = 1 - frequency

    if (voice === history[0] && consecutiveDominance >= 3) {
      modifiers[voice] = -perseverationPenalty
    } else if (counts[voice] === 0) {
      modifiers[voice] = NOVELTY_BOOST_MAX * switchingGain
    } else {
      modifiers[voice] = underRepresentation * NOVELTY_BOOST_MAX * switchingGain * 0.5
    }
  }

  return modifiers
}

/**
 * Count how many times the most recent dominant voice appears consecutively from the front.
 */
function countConsecutiveLeader(history: InnerVoice[]): number {
  if (history.length === 0) return 0
  const leader = history[0]
  let count = 0
  for (const voice of history) {
    if (voice !== leader) break
    count++
  }
  return count
}

function getBigFiveWeights(bigFive: BigFive): Partial<Record<InnerVoice, number>> {
  return {
    seeking: bigFive.openness * 0.3,
    care: (bigFive.extraversion + bigFive.agreeableness) * 0.15,
    executive: bigFive.conscientiousness * 0.25,
    fear: bigFive.conscientiousness * 0.15 + bigFive.neuroticism * 0.2,
    play: bigFive.openness * 0.15 + bigFive.agreeableness * 0.1,
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
