import { clamp } from "@/infra/lib/math.ts"
import { SOMATIC_CONVERSION } from "./constants.ts"
import type { ActiveStrategy, ConversionSignal } from "./types.ts"
import { DEFAULT_CONVERSION_SIGNAL } from "./types.ts"

/**
 * Compute somatic conversion signal from active defense strategies.
 * When defense mechanisms block emotional expression, the blocked energy
 * converts into somatic activation — the classic psychosomatic mechanism.
 */
export function computeConversionSignal(activeStrategies: ActiveStrategy[], cortisolLevel: number): ConversionSignal {
  if (activeStrategies.length === 0) return DEFAULT_CONVERSION_SIGNAL

  const cortisolAmplifier =
    1 + Math.max(0, cortisolLevel - SOMATIC_CONVERSION.CORTISOL_BASELINE) * SOMATIC_CONVERSION.CORTISOL_AMPLIFIER

  const somaticDeltas: Record<string, number> = {}
  const regionalDeltas: Record<string, number> = {}

  for (const strategy of activeStrategies) {
    const somaProfile = SOMATIC_CONVERSION.STRATEGY_SOMA_PROFILES[strategy.type]
    const regionalProfile = SOMATIC_CONVERSION.STRATEGY_REGIONAL_PROFILES[strategy.type]
    if (!somaProfile || !regionalProfile) continue

    const scale = strategy.intensity * cortisolAmplifier

    for (const [key, weight] of Object.entries(somaProfile)) {
      if (weight === 0) continue
      const delta = clamp(weight * scale, -SOMATIC_CONVERSION.MAX_DELTA, SOMATIC_CONVERSION.MAX_DELTA)
      somaticDeltas[key] = (somaticDeltas[key] ?? 0) + delta
    }

    for (const [key, weight] of Object.entries(regionalProfile)) {
      if (weight === 0) continue
      const delta = clamp(weight * scale, -SOMATIC_CONVERSION.MAX_DELTA, SOMATIC_CONVERSION.MAX_DELTA)
      regionalDeltas[key] = (regionalDeltas[key] ?? 0) + delta
    }
  }

  for (const key of Object.keys(somaticDeltas)) {
    somaticDeltas[key] = clamp(somaticDeltas[key] ?? 0, -SOMATIC_CONVERSION.MAX_DELTA, SOMATIC_CONVERSION.MAX_DELTA)
  }

  for (const key of Object.keys(regionalDeltas)) {
    regionalDeltas[key] = clamp(regionalDeltas[key] ?? 0, -SOMATIC_CONVERSION.MAX_DELTA, SOMATIC_CONVERSION.MAX_DELTA)
  }

  return { somaticDeltas, regionalDeltas }
}
