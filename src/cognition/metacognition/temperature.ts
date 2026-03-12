import type { MetacognitiveState } from "@/cognition/types.ts"

const BASE_TEMPERATURE = 0.75
const FATIGUE_BOOST = 0.15
const CLARITY_REDUCTION = 0.1
const RUMINATION_BOOST = 0.05
const MIN_TEMPERATURE = 0.6
const MAX_TEMPERATURE = 0.9

/**
 * Derive LLM temperature from metacognitive state.
 * Higher fatigue / rumination → more creative (higher temp).
 * Higher clarity → more focused (lower temp).
 */
export function computeTemperatureFromMetacognition(state: MetacognitiveState): number {
  let temperature = BASE_TEMPERATURE

  temperature += state.cognitiveFatigue * FATIGUE_BOOST
  temperature -= state.cognitiveClarity * CLARITY_REDUCTION
  if (state.ruminationDetected) {
    temperature += RUMINATION_BOOST
  }

  return Math.max(MIN_TEMPERATURE, Math.min(MAX_TEMPERATURE, temperature))
}
