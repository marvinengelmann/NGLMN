import type { EmotionalState, EmotionUpdateEvent } from "@/affect/emotion/types.ts"
import { clamp01 } from "@/infra/lib/math.ts"
import { AMPLIFICATION } from "./constants.ts"
import type { SomaticState } from "./types.ts"

/**
 * Compute how much attention is directed inward toward body signals.
 * High caution + low openness + idle state = more body-focused attention.
 */
export function computeSomaticAttentionFocus(emotion: EmotionalState, consecutiveIdleTicks: number): number {
  const idleFactor = Math.min(1, consecutiveIdleTicks * 0.1)

  const raw =
    (emotion.caution - 0.5) * AMPLIFICATION.CAUTION_WEIGHT +
    idleFactor * AMPLIFICATION.IDLE_WEIGHT +
    (emotion.energy - 0.5) * AMPLIFICATION.ENERGY_WEIGHT

  return clamp01(Math.max(0, raw) * (1 / AMPLIFICATION.MAX_FOCUS))
}

/**
 * Amplify perceived somatic state based on inward attention focus.
 * Does NOT modify actual soma — only the perception fed to emotion construction.
 */
export function amplifySomaticPerception(
  actualSoma: SomaticState,
  attentionFocus: number,
  interoceptiveAccuracy: number
): SomaticState {
  if (attentionFocus < 0.1) return actualSoma

  const amplificationStrength = attentionFocus * AMPLIFICATION.MAX_AMPLIFICATION
  const accuracyModulator = 0.5 + interoceptiveAccuracy * 0.5

  return {
    ...actualSoma,
    tension: clamp01(actualSoma.tension + (actualSoma.tension - 0.3) * amplificationStrength * accuracyModulator),
    heartRate: clamp01(actualSoma.heartRate + (actualSoma.heartRate - 0.3) * amplificationStrength * accuracyModulator),
    breathing: clamp01(
      actualSoma.breathing + (actualSoma.breathing - 0.5) * amplificationStrength * accuracyModulator * 0.5
    ),
    gravity: clamp01(actualSoma.gravity + (actualSoma.gravity - 0.4) * amplificationStrength * accuracyModulator * 0.5)
  }
}

/**
 * Generate emotion triggers from misinterpreted body signals.
 * When interoceptive accuracy is low AND attention focus is high,
 * normal body signals may be perceived as threatening.
 */
export function computeMisinterpretationTriggers(
  actualSoma: SomaticState,
  perceivedSoma: SomaticState,
  interoceptiveAccuracy: number,
  attentionFocus: number
): EmotionUpdateEvent[] {
  if (interoceptiveAccuracy > AMPLIFICATION.MISINTERPRETATION_ACCURACY_THRESHOLD) return []
  if (attentionFocus < AMPLIFICATION.MISINTERPRETATION_FOCUS_THRESHOLD) return []

  const triggers: EmotionUpdateEvent[] = []
  const perceptionGap = 1 - interoceptiveAccuracy

  const tensionDifference = perceivedSoma.tension - actualSoma.tension
  if (tensionDifference > 0.1) {
    triggers.push({
      trigger: "ambient",
      intensity: clamp01(tensionDifference * perceptionGap * AMPLIFICATION.MISINTERPRETATION_INTENSITY),
      detail: "somatic_misinterpretation_tension"
    })
  }

  const heartRateDifference = perceivedSoma.heartRate - actualSoma.heartRate
  if (heartRateDifference > 0.1) {
    triggers.push({
      trigger: "ambient",
      intensity: clamp01(heartRateDifference * perceptionGap * AMPLIFICATION.MISINTERPRETATION_INTENSITY),
      detail: "somatic_misinterpretation_cardiac"
    })
  }

  return triggers.slice(0, 2)
}
