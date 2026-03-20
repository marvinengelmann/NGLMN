import type { EmotionalState } from "@/affect/emotion/types.ts"
import { clamp01, halfLifeDecay } from "@/infra/lib/math.ts"
import { REGIONS } from "./constants.ts"
import { BODY_REGIONS, type BodyRegionMap } from "./types.ts"
import { circadianFatigue } from "./update.ts"

type EmotionDimension = keyof typeof REGIONS.EMOTION_WEIGHTS
const EMOTION_DIMENSIONS = Object.keys(REGIONS.EMOTION_WEIGHTS) as EmotionDimension[]

/**
 * Compute regional activation targets from the current emotional state.
 * Each emotion drives specific body regions with empirically-grounded weights
 * based on Nummenmaa et al. (2014) body sensation maps.
 */
export function computeRegionalTarget(emotion: EmotionalState, hourOfDay: number): BodyRegionMap {
  const fatigue = circadianFatigue(hourOfDay)
  const result = {} as BodyRegionMap

  for (const region of BODY_REGIONS) {
    let activation = REGIONS.BASELINES[region]

    for (const dim of EMOTION_DIMENSIONS) {
      const deviation = (emotion[dim as keyof EmotionalState] - 0.5) * 2
      activation += deviation * REGIONS.EMOTION_WEIGHTS[dim][region]
    }

    activation += fatigue * REGIONS.CIRCADIAN_FATIGUE[region]
    result[region] = clamp01(activation)
  }

  return result
}

/**
 * Apply exponential decay hysteresis to regional activations.
 * Each body region has a distinct half-life — gut tension lingers longest,
 * throat constriction resolves fastest.
 */
export function applyRegionalHysteresis(
  current: BodyRegionMap,
  target: BodyRegionMap,
  elapsedMinutes: number
): BodyRegionMap {
  const result = {} as BodyRegionMap

  for (const region of BODY_REGIONS) {
    const decay = halfLifeDecay(elapsedMinutes, REGIONS.HALF_LIVES[region])
    result[region] = clamp01(target[region] + (current[region] - target[region]) * decay)
  }

  return result
}
