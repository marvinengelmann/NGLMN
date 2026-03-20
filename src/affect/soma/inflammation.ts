import { clamp01, halfLifeDecay } from "@/infra/lib/math.ts"
import { INFLAMMATION } from "./constants.ts"

/**
 * Update inflammation level based on chronic cortisol elevation.
 * Acute cortisol spikes don't cause inflammation — only sustained elevation above threshold.
 */
export function computeInflammationUpdate(currentLevel: number, cortisolLevel: number, elapsedMinutes: number): number {
  const decayFactor = halfLifeDecay(elapsedMinutes, INFLAMMATION.HALF_LIFE)
  let level = INFLAMMATION.BASELINE + (currentLevel - INFLAMMATION.BASELINE) * decayFactor

  const cortisolExcess = Math.max(0, cortisolLevel - INFLAMMATION.CHRONIC_CORTISOL_THRESHOLD)
  if (cortisolExcess > 0) {
    level += cortisolExcess * INFLAMMATION.ACCUMULATION_RATE * (elapsedMinutes / 60)
  }

  return clamp01(level)
}

/**
 * Compute somatic target shifts caused by active inflammation.
 * Inflammation increases tension and gravity, decreases openness and warmth.
 */
export function computeInflammationSomaticShifts(inflammationLevel: number): Record<string, number> {
  if (inflammationLevel < 0.1) return {}

  return {
    tension: inflammationLevel * INFLAMMATION.TENSION_SHIFT,
    gravity: inflammationLevel * INFLAMMATION.GRAVITY_SHIFT,
    openness: inflammationLevel * INFLAMMATION.OPENNESS_SHIFT,
    warmth: inflammationLevel * INFLAMMATION.WARMTH_SHIFT
  }
}
