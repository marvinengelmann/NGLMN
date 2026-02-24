import type { EmotionalState, MetricsSnapshot } from "@/emotion/types.ts"
import { getEmotionBaseline } from "@/personality/mbti.ts"
import { clampState } from "./update.ts"

const MORNING_BASELINE_WEIGHT = 0.7
const MORNING_CURRENT_WEIGHT = 0.3

/**
 * Morning recalibration: strong drift towards baseline.
 * Formula: 0.3 * current + 0.7 * baseline
 */
export function morningRecalibration(current: EmotionalState): EmotionalState {
  const baseline = getEmotionBaseline()
  return clampState({
    curiosity: current.curiosity * MORNING_CURRENT_WEIGHT + baseline.curiosity * MORNING_BASELINE_WEIGHT,
    satisfaction: current.satisfaction * MORNING_CURRENT_WEIGHT + baseline.satisfaction * MORNING_BASELINE_WEIGHT,
    frustration: current.frustration * MORNING_CURRENT_WEIGHT + baseline.frustration * MORNING_BASELINE_WEIGHT,
    boredom: current.boredom * MORNING_CURRENT_WEIGHT + baseline.boredom * MORNING_BASELINE_WEIGHT,
    excitement: current.excitement * MORNING_CURRENT_WEIGHT + baseline.excitement * MORNING_BASELINE_WEIGHT,
    caution: current.caution * MORNING_CURRENT_WEIGHT + baseline.caution * MORNING_BASELINE_WEIGHT,
    connection: current.connection * MORNING_CURRENT_WEIGHT + baseline.connection * MORNING_BASELINE_WEIGHT
  })
}

/**
 * Metrics-based recalibration: corrects emotional state discrepancies
 * when emotions don't match reality (e.g., satisfied despite high errors).
 */
export function metricsRecalibration(current: EmotionalState, metrics: MetricsSnapshot): EmotionalState {
  const result = { ...current }

  if (result.satisfaction > 0.7 && metrics.errorRate > 0.3) {
    result.satisfaction -= 0.1
  }

  if (result.frustration < 0.2 && metrics.errorRate > 0.5) {
    result.frustration += 0.1
  }

  if (result.boredom > 0.7 && metrics.interactionCount > 20) {
    result.boredom -= 0.1
  }

  if (result.excitement > 0.7 && metrics.idleRatio > 0.8) {
    result.excitement -= 0.1
  }

  if (metrics.rollbackCount > 0 && result.caution < 0.5) {
    result.caution += 0.1 * Math.min(metrics.rollbackCount, 3)
  }

  return clampState(result)
}
