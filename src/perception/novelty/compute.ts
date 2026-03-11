import type { EmotionalState } from "@/affect/emotion/types.ts"
import { log } from "@/infra/lib/logger.ts"
import type { ExpectationViolation } from "@/perception/anticipation/types.ts"
import { NOVELTY } from "./constants.ts"
import { computeSemanticNovelty } from "./semantic.ts"
import type { NoveltyState, SurpriseState } from "./types.ts"

/**
 * Compute novelty level by comparing stimulus against habituation map.
 */
export function computeNoveltyLevel(
  stimulus: string,
  habituationMap: Record<string, number>
): { level: number; updatedMap: Record<string, number> } {
  const key = stimulus.toLowerCase().trim().slice(0, NOVELTY.KEY_MAX_LENGTH)
  const exposureCount = habituationMap[key] ?? 0
  const novelty = Math.max(0, 1 - exposureCount * NOVELTY.HABITUATION_DECAY_PER_EXPOSURE)

  const updatedMap = { ...habituationMap, [key]: exposureCount + 1 }

  const keys = Object.keys(updatedMap)
  if (keys.length > NOVELTY.MAX_HABITUATION_ENTRIES) {
    keys.slice(0, keys.length - NOVELTY.MAX_HABITUATION_ENTRIES).forEach((k) => {
      delete updatedMap[k]
    })
  }

  return { level: novelty, updatedMap }
}

/**
 * Compute surprise from expectation violations and novelty.
 */
export function computeSurprise(
  violations: ExpectationViolation[],
  noveltyLevel: number,
  previousSurprise: SurpriseState
): SurpriseState {
  if (violations.length === 0 && noveltyLevel < NOVELTY.SURPRISE_LOW_NOVELTY_THRESHOLD) {
    return {
      level: Math.max(0, previousSurprise.level * NOVELTY.SURPRISE_DECAY),
      isActive: false,
      valence: 0,
      source: null
    }
  }

  const initial = {
    maxSurprise: noveltyLevel * NOVELTY.SURPRISE_NOVELTY_WEIGHT,
    dominantValence: 0,
    dominantSource: noveltyLevel > NOVELTY.SURPRISE_LOW_NOVELTY_THRESHOLD ? "novelty" as string | null : null as string | null
  }

  const { maxSurprise, dominantValence, dominantSource } = violations.reduce((acc, violation) => {
    if (violation.surpriseIntensity > acc.maxSurprise) {
      return {
        maxSurprise: violation.surpriseIntensity,
        dominantValence: violation.valence,
        dominantSource: violation.actualOutcome
      }
    }
    return acc
  }, initial)

  const level = Math.min(1, maxSurprise)

  return {
    level,
    isActive: level > NOVELTY.SURPRISE_ACTIVATION_THRESHOLD,
    valence: dominantValence,
    source: dominantSource
  }
}

/**
 * Compute novelty effect on base emotions.
 */
export function computeNoveltyEffect(
  noveltyLevel: number,
  surpriseState: SurpriseState
): Partial<Record<keyof EmotionalState, number>> {
  if (noveltyLevel < NOVELTY.NOVELTY_ACTIVATION_THRESHOLD && !surpriseState.isActive) return {}

  const effects: Partial<Record<keyof EmotionalState, number>> = {}

  if (noveltyLevel > NOVELTY.NOVELTY_EFFECT_THRESHOLD) {
    effects.curiosity = noveltyLevel * NOVELTY.CURIOSITY_BOOST
    effects.excitement = noveltyLevel * NOVELTY.EXCITEMENT_BOOST
    effects.boredom = -noveltyLevel * NOVELTY.BOREDOM_REDUCTION
  }

  if (surpriseState.isActive) {
    effects.excitement = (effects.excitement ?? 0) + surpriseState.level * NOVELTY.SURPRISE_EXCITEMENT_BOOST
    if (surpriseState.valence < 0) {
      effects.caution = (effects.caution ?? 0) + surpriseState.level * NOVELTY.SURPRISE_CAUTION_BOOST
    }
  }

  return effects
}

/**
 * Update full novelty state from message content.
 * When useSemanticNovelty is true, uses vector similarity instead of string matching.
 */
export async function updateNoveltyState(
  previous: NoveltyState,
  messageTexts: string[],
  emotion: EmotionalState,
  useSemanticNovelty: boolean = false
): Promise<NoveltyState> {
  if (messageTexts.length === 0) {
    return {
      ...previous,
      level: Math.max(0, previous.level * NOVELTY.NOVELTY_DECAY_PER_TICK),
      isActive: previous.level * NOVELTY.NOVELTY_DECAY_PER_TICK > NOVELTY.NOVELTY_ACTIVATION_THRESHOLD,
      noveltySeekingUrge: Math.min(
        1,
        previous.noveltySeekingUrge + emotion.boredom * NOVELTY.NOVELTY_SEEKING_BOREDOM_SCALE
      )
    }
  }

  let maxNovelty = 0
  let source: string | null = null
  let habituationMap = { ...previous.habituationMap }

  const processText = async (text: string): Promise<void> => {
    if (useSemanticNovelty) {
      try {
        const result = await computeSemanticNovelty(text)
        if (result) {
          if (result.level > maxNovelty) {
            maxNovelty = result.level
            source = text.slice(0, NOVELTY.SOURCE_PREVIEW_LENGTH)
          }
          return
        }
      } catch (e) {
        log.warn("Semantic novelty failed, falling back to string-based", { error: String(e) })
      }
    }
    const { level, updatedMap } = computeNoveltyLevel(text, habituationMap)
    habituationMap = updatedMap
    if (level > maxNovelty) {
      maxNovelty = level
      source = text.slice(0, NOVELTY.SOURCE_PREVIEW_LENGTH)
    }
  }

  await messageTexts.reduce(
    (chain, text) => chain.then(() => processText(text)),
    Promise.resolve()
  )

  const noveltySeekingUrge =
    maxNovelty > 0.5
      ? Math.max(0, previous.noveltySeekingUrge - NOVELTY.NOVELTY_SEEKING_DECAY)
      : Math.min(1, previous.noveltySeekingUrge + emotion.boredom * NOVELTY.NOVELTY_SEEKING_IDLE_SCALE)

  return {
    level: maxNovelty,
    isActive: maxNovelty > NOVELTY.NOVELTY_ACTIVATION_THRESHOLD,
    source,
    habituationMap,
    noveltySeekingUrge
  }
}
