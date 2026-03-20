import { clamp01, halfLifeDecay } from "@/infra/lib/math.ts"
import { SENSITIZATION } from "./constants.ts"
import { BODY_REGIONS, type BodyRegionMap } from "./types.ts"

/**
 * Update per-region sensitization levels based on current regional activation.
 * Regions activated above threshold accumulate sensitization slowly;
 * sensitization decays with a half-life of days, not minutes.
 */
export function updateSensitization(
  profile: BodyRegionMap,
  regionalActivation: BodyRegionMap,
  elapsedMinutes: number
): BodyRegionMap {
  const decayFactor = halfLifeDecay(elapsedMinutes, SENSITIZATION.DECAY_HALF_LIFE_HOURS * 60)
  const result = {} as BodyRegionMap

  for (const region of BODY_REGIONS) {
    let level = profile[region] * decayFactor

    if (regionalActivation[region] > SENSITIZATION.ACTIVATION_THRESHOLD) {
      const excess = regionalActivation[region] - SENSITIZATION.ACTIVATION_THRESHOLD
      level += excess * SENSITIZATION.ACCUMULATION_RATE
    }

    result[region] = clamp01(level)
  }

  return result
}

/**
 * Amplify regional activation targets based on sensitization levels.
 * Sensitized regions respond more strongly to the same emotional inputs.
 */
export function applySensitizationAmplification(
  regionalTarget: BodyRegionMap,
  sensitization: BodyRegionMap
): BodyRegionMap {
  const result = {} as BodyRegionMap

  for (const region of BODY_REGIONS) {
    if (sensitization[region] < SENSITIZATION.MIN_LEVEL_FOR_EFFECT) {
      result[region] = regionalTarget[region]
      continue
    }

    const amplification = 1 + sensitization[region] * (SENSITIZATION.MAX_AMPLIFICATION - 1)
    result[region] = clamp01(regionalTarget[region] * amplification)
  }

  return result
}
