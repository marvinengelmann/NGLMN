import type { EmotionalState } from "@/affect/emotion/types.ts"
import type { SomaticState } from "@/affect/soma/types.ts"
import { METACOGNITION } from "@/cognition/constants.ts"
import { clamp01 } from "@/infra/lib/math.ts"
import type { MetacognitiveState } from "./types.ts"

interface ClarityContext {
  emotion: EmotionalState
  soma: SomaticState
  fatigue: number
  coherenceScore: number
}

/**
 * Compute cognitive clarity from emotional, somatic, fatigue, and coherence factors.
 */
export function computeCognitiveClarity(context: ClarityContext): number {
  const emotionClarity = 1 - (context.emotion.frustration * 0.4 + context.emotion.excitement * 0.2)
  const somaClarity = 1 - context.soma.tension * 0.5
  const fatigueClarity = 1 - context.fatigue
  const coherenceClarity = context.coherenceScore

  return Math.max(
    0,
    Math.min(
      1,
      emotionClarity * METACOGNITION.CLARITY_EMOTION_WEIGHT +
        somaClarity * METACOGNITION.CLARITY_SOMA_WEIGHT +
        fatigueClarity * METACOGNITION.CLARITY_FATIGUE_WEIGHT +
        coherenceClarity * METACOGNITION.CLARITY_COHERENCE_WEIGHT
    )
  )
}

/**
 * Detect rumination from repeated reasoning themes.
 */
export function detectRumination(
  recentReasonings: string[],
  previousState: MetacognitiveState
): { detected: boolean; topic: string | null; ticks: number } {
  if (recentReasonings.length < 2) {
    return { detected: false, topic: null, ticks: 0 }
  }

  const themes = recentReasonings.reduce((map, reasoning) => {
    reasoning
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 5)
      .forEach((word) => {
        map.set(word, (map.get(word) ?? 0) + 1)
      })
    return map
  }, new Map<string, number>())

  const { topTheme, topCount } = [...themes.entries()].reduce(
    (best, [theme, count]) => (count > best.topCount ? { topTheme: theme, topCount: count } : best),
    { topTheme: null as string | null, topCount: 0 }
  )

  const detected = topCount >= METACOGNITION.RUMINATION_THRESHOLD_TICKS
  const isSameTopic = previousState.ruminationTopic === topTheme
  const ticks = detected ? (isSameTopic ? previousState.ruminationTicks + 1 : 1) : 0

  return { detected, topic: detected ? topTheme : null, ticks }
}

/**
 * Compute cognitive fatigue from complex decisions and time.
 */
export function computeCognitiveFatigue(
  previousFatigue: number,
  isComplexDecision: boolean,
  isDreaming: boolean
): number {
  let fatigue = previousFatigue * METACOGNITION.FATIGUE_DECAY_PER_TICK

  if (isComplexDecision) {
    fatigue += METACOGNITION.FATIGUE_PER_COMPLEX_DECISION
  }

  if (isDreaming) {
    fatigue = Math.max(0, fatigue - METACOGNITION.FATIGUE_SLEEP_RESET)
  }

  return clamp01(fatigue)
}

/**
 * Compute metacognitive modifiers for deliberation.
 */
export function computeMetacognitiveModifiers(state: MetacognitiveState): {
  hedgingLevel: number
  confidenceModifier: number
} {
  const hedgingLevel =
    state.cognitiveFatigue > METACOGNITION.HEDGING_FATIGUE_THRESHOLD ? state.cognitiveFatigue * 0.5 : 0

  const confidenceModifier = state.ruminationDetected
    ? -METACOGNITION.CONFIDENCE_MODIFIER_SCALE
    : state.cognitiveClarity > 0.7
      ? METACOGNITION.CONFIDENCE_MODIFIER_SCALE * 0.5
      : 0

  return { hedgingLevel, confidenceModifier }
}

/**
 * Update full metacognitive state.
 */
export function updateMetacognitiveState(
  previous: MetacognitiveState,
  context: {
    emotion: EmotionalState
    soma: SomaticState
    coherenceScore: number
    recentReasonings: string[]
    isComplexDecision: boolean
    isDreaming: boolean
  }
): MetacognitiveState {
  const cognitiveFatigue = computeCognitiveFatigue(
    previous.cognitiveFatigue,
    context.isComplexDecision,
    context.isDreaming
  )

  const cognitiveClarity = computeCognitiveClarity({
    emotion: context.emotion,
    soma: context.soma,
    fatigue: cognitiveFatigue,
    coherenceScore: context.coherenceScore
  })

  const rumination = detectRumination(context.recentReasonings, previous)

  return {
    cognitiveClarity,
    ruminationDetected: rumination.detected,
    ruminationTopic: rumination.topic,
    ruminationTicks: rumination.ticks,
    confidenceCalibration: previous.confidenceCalibration,
    cognitiveFatigue,
    complexDecisionCount: context.isComplexDecision ? previous.complexDecisionCount + 1 : previous.complexDecisionCount
  }
}
