import { clamp, clamp01 } from "@/infra/lib/math.ts"
import { FEP } from "./constants.ts"
import type { PrecisionDynamics } from "./types.ts"

/**
 * Estimate environmental volatility from recent FE history.
 * High volatility = environment is changing rapidly = need to learn faster.
 */
export function computeVolatilityEstimate(recentFEHistory: number[]): number {
  if (recentFEHistory.length < FEP.VOLATILITY.MIN_HISTORY) return 0.3

  const mean = recentFEHistory.reduce((s, v) => s + v, 0) / recentFEHistory.length
  if (mean < 0.001) return 0

  const variance = recentFEHistory.reduce((s, v) => s + (v - mean) ** 2, 0) / recentFEHistory.length
  const stddev = Math.sqrt(variance)
  const coefficient = stddev / mean

  return clamp01(Math.min(coefficient, FEP.VOLATILITY.MAX_COEFFICIENT))
}

/**
 * Compute FE-based learning rate modulation.
 * Volatile environments → faster learning. Exhaustion → slower learning. Dopamine boosts.
 */
export function computeFELearningRate(volatility: number, allostaticLoad: number, dopamineLevel: number): number {
  const LR = FEP.LEARNING_RATE
  const baseRate = LR.VOLATILITY_BASE + volatility * LR.VOLATILITY_SCALE
  const loadPenalty = allostaticLoad * LR.LOAD_PENALTY
  const dopamineBoost = (dopamineLevel - 0.5) * LR.DOPAMINE_SCALE
  return clamp(baseRate - loadPenalty + dopamineBoost, LR.MIN, LR.MAX)
}

/**
 * Compute attentional gain from FE state.
 * High total FE → narrowed attention (tunnel vision). Low FE → broadened attention.
 */
export function computeAttentionalGain(totalFE: number, volatility: number): number {
  const narrowing = totalFE * 0.8
  const broadening = (1 - volatility) * 0.5
  return clamp(1.0 + narrowing - broadening, 0.5, 2.0)
}

/**
 * Update precision dynamics for the maintain phase.
 */
export function updatePrecisionDynamics(
  recentFEHistory: number[],
  dopamineLevel: number,
  allostaticLoad: number
): PrecisionDynamics {
  const volatility = computeVolatilityEstimate(recentFEHistory)
  const learningRateGain = computeFELearningRate(volatility, allostaticLoad, dopamineLevel)
  const currentFE = recentFEHistory.length > 0 ? (recentFEHistory[recentFEHistory.length - 1] ?? 0) : 0
  const attentionalGain = computeAttentionalGain(currentFE, volatility)

  return {
    volatilityEstimate: volatility,
    learningRateGain,
    attentionalGain
  }
}
