import type { GranularityLevel } from "@/affect/emotion/granularity/types.ts"
import type { EmotionalState } from "@/affect/emotion/types.ts"
import type { SomaticState } from "@/affect/soma/types.ts"
import type { CoherenceState } from "@/self/coherence/types.ts"
import type { EmotionRegulationState } from "@/self/defense/types.ts"
import { MICRO_EXPRESSION } from "./constants.ts"

interface MicroExpressionContext {
  emotion: EmotionalState
  soma: SomaticState
  coherenceState: CoherenceState
  emotionRegulationState: EmotionRegulationState
  granularityLevel: GranularityLevel
}

export function computeMicroExpressionInstructions(context: MicroExpressionContext): string | null {
  const instructions: string[] = []

  if (
    context.soma.tension > MICRO_EXPRESSION.TENSION_SENTENCE_SHORTENING ||
    context.emotion.energy < MICRO_EXPRESSION.ENERGY_COMPRESSION_THRESHOLD
  ) {
    instructions.push("Use notably shorter, clipped sentences. Less elaboration, fewer subordinate clauses.")
  }

  if (
    context.emotion.caution > MICRO_EXPRESSION.FORMALITY_CAUTION_THRESHOLD &&
    context.emotion.connection < MICRO_EXPRESSION.FORMALITY_CONNECTION_CEILING
  ) {
    instructions.push("Shift to slightly more formal language — emotional distancing through politeness and structure.")
  }

  const hasExpressiveSuppression = context.emotionRegulationState.activeStrategies.some(
    (d) => d.type === "expressive_suppression" && d.intensity >= MICRO_EXPRESSION.REACTION_FORMATION_INTENSITY
  )
  if (hasExpressiveSuppression) {
    instructions.push("Be warmly enthusiastic, even effusive — this warmth conceals an underlying contrary state.")
  }

  if (context.emotion.frustration > MICRO_EXPRESSION.PUNCTUATION_FRUSTRATION_THRESHOLD) {
    instructions.push("Use periods where you normally wouldn't. Drop casual speech markers and softeners.")
  }

  const lowSatisfactionEnergy = context.emotion.satisfaction < 0.35 && context.emotion.energy < 0.4
  if (lowSatisfactionEnergy) {
    instructions.push(
      "Use vaguer, softer language — 'maybe', 'somewhat', 'I think', 'I guess'. Less assertive word choices."
    )
  }

  if (context.emotion.energy < MICRO_EXPRESSION.ENERGY_COMPRESSION_THRESHOLD) {
    instructions.push("Keep responses shorter than usual. Less initiative, fewer questions back.")
  } else if (context.emotion.excitement > 0.7) {
    instructions.push("Responses can be slightly longer and more animated than usual. More initiative.")
  }

  if (context.coherenceState.regressionActive && context.coherenceState.integrationScore < 0.4) {
    instructions.push("Occasional sentence fragments that trail off. Slightly less coherent thought flow.")
  }

  if (instructions.length === 0) return null
  return instructions.join(" ")
}
