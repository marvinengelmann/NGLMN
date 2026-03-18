import { FEP } from "./constants.ts"
import type { FreeEnergyDecomposition, PEChannelName, PrecisionWeights, PredictionErrorChannel } from "./types.ts"

/**
 * Compute emotion deltas driven by free energy state.
 * High FE → vigilance + fatigue. Low FE → calm satisfaction. High allostatic load → depletion.
 */
export function computeFEEmotionModulation(
  decomposition: FreeEnergyDecomposition,
  allostaticLoad: number
): Record<string, number> {
  const deltas: Record<string, number> = {}
  const M = FEP.EMOTION_MODULATION

  if (decomposition.total > M.HIGH_FE_THRESHOLD) {
    deltas.caution = M.HIGH_FE_CAUTION
    deltas.energy = -M.HIGH_FE_ENERGY_DRAIN
  }

  if (allostaticLoad > M.HIGH_LOAD_THRESHOLD) {
    deltas.satisfaction = (deltas.satisfaction ?? 0) - M.HIGH_LOAD_SATISFACTION_DRAIN
    deltas.energy = (deltas.energy ?? 0) - M.HIGH_LOAD_ENERGY_DRAIN
  }

  if (decomposition.total < M.LOW_FE_THRESHOLD) {
    deltas.satisfaction = (deltas.satisfaction ?? 0) + M.LOW_FE_SATISFACTION
    deltas.confidence = (deltas.confidence ?? 0) + M.LOW_FE_CONFIDENCE
  }

  return deltas
}

/**
 * Compute attention bias from FE channels.
 * The channel with the highest weighted error dominates attention.
 */
export function computeFEAttentionBias(
  channels: PredictionErrorChannel[],
  _precisions: PrecisionWeights
): { dominantChannel: PEChannelName; narrowing: number } {
  let maxWeighted = 0
  let dominant: PEChannelName = "interoceptive"

  for (const ch of channels) {
    if (ch.weightedError > maxWeighted) {
      maxWeighted = ch.weightedError
      dominant = ch.name
    }
  }

  const totalWeightedError = channels.reduce((s, ch) => s + ch.weightedError, 0)
  const narrowing = Math.min(1, totalWeightedError * 2)

  return { dominantChannel: dominant, narrowing }
}

/**
 * Compute pressure to resolve active regulation strategies.
 * Each strategy increases complexity cost → subtle push toward authenticity.
 */
export function computeRegulationCostPressure(activeStrategyCount: number, complexityCost: number): number {
  if (activeStrategyCount === 0) return 0
  return Math.min(1, (activeStrategyCount / FEP.MAX_STRATEGY_COUNT) * complexityCost * 2)
}
