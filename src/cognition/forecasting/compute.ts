import type { EmotionalState, EmotionUpdateEvent } from "@/affect/emotion/types.ts"
import { clamp01 } from "@/infra/lib/math.ts"
import { nowISO } from "@/infra/lib/time.ts"
import { FORECASTING } from "./constants.ts"
import type { AffectiveForecast, ForecastAccuracy, ForecastBiasType, ForecastingState } from "./types.ts"

export function shouldForecast(
  state: ForecastingState,
  ticksSinceLastForecast: number,
  triggers: EmotionUpdateEvent[]
): boolean {
  if (state.activeForecast && !state.activeForecast.resolvedAt) return false
  if (ticksSinceLastForecast < FORECASTING.FORECAST_COOLDOWN_TICKS) return false

  const hasTrigger = triggers.some((t) => FORECASTING.FORECAST_TRIGGERS.includes(t.trigger))
  if (!hasTrigger) return false

  return Math.random() < FORECASTING.FORECAST_PROBABILITY
}

export function generateForecast(
  trigger: EmotionUpdateEvent,
  emotion: EmotionalState,
  biasStrengths: Record<ForecastBiasType, number>
): AffectiveForecast {
  const entries = Object.entries(emotion) as [string, number][]
  const sorted = entries.sort((a, b) => Math.abs(b[1] - 0.5) - Math.abs(a[1] - 0.5))
  const dominant = sorted[0]
  if (!dominant) {
    return createNeutralForecast(trigger.trigger)
  }

  const biasesApplied: ForecastBiasType[] = []
  let predictedIntensity = trigger.intensity

  if (biasStrengths.impact_bias > 0) {
    const amplification = 1 + (FORECASTING.IMPACT_BIAS_MULTIPLIER - 1) * biasStrengths.impact_bias
    predictedIntensity = clamp01(predictedIntensity * amplification)
    biasesApplied.push("impact_bias")
  }

  let predictedDuration = Math.round(
    FORECASTING.BASE_DURATION_OFFSET + trigger.intensity * FORECASTING.BASE_DURATION_SCALE
  )
  predictedDuration = Math.round(
    predictedDuration * (1 + (FORECASTING.DURATION_BIAS_MULTIPLIER - 1) * biasStrengths.impact_bias)
  )

  const predictedEmotion: Record<string, number> = {}
  if (biasStrengths.focalism > 0) {
    const focusWeight = FORECASTING.FOCALISM_WEIGHT * biasStrengths.focalism
    predictedEmotion[dominant[0]] = clamp01((dominant[1] - 0.5) * predictedIntensity * focusWeight)
    biasesApplied.push("focalism")
  } else {
    for (const [key, value] of entries) {
      const delta = (value - 0.5) * predictedIntensity * FORECASTING.DIFFUSE_SPREAD_SCALE
      if (Math.abs(delta) > FORECASTING.DIFFUSE_DELTA_THRESHOLD) {
        predictedEmotion[key] = delta
      }
    }
  }

  if (biasStrengths.immune_neglect > 0) {
    predictedDuration = Math.round(
      predictedDuration * (1 + (1 - FORECASTING.IMMUNE_NEGLECT_FACTOR) * biasStrengths.immune_neglect)
    )
    biasesApplied.push("immune_neglect")
  }

  return {
    id: crypto.randomUUID(),
    predictedEmotion,
    predictedIntensity,
    predictedDuration,
    triggerEvent: trigger.trigger,
    biasesApplied,
    madeAt: nowISO(),
    resolvedAt: null,
    actualOutcome: null
  }
}

function createNeutralForecast(triggerEvent: string): AffectiveForecast {
  return {
    id: crypto.randomUUID(),
    predictedEmotion: {},
    predictedIntensity: FORECASTING.NEUTRAL_FORECAST_INTENSITY,
    predictedDuration: FORECASTING.NEUTRAL_FORECAST_DURATION,
    triggerEvent,
    biasesApplied: [],
    madeAt: nowISO(),
    resolvedAt: null,
    actualOutcome: null
  }
}

export function resolveForecast(
  forecast: AffectiveForecast,
  currentEmotion: EmotionalState,
  ticksElapsed: number
): AffectiveForecast {
  const emotionEntries = Object.entries(currentEmotion) as [string, number][]
  const peakIntensity = Math.max(...emotionEntries.map(([, v]) => Math.abs(v - 0.5))) * 2

  const actualDeltas: Record<string, number> = {}
  for (const [key, value] of emotionEntries) {
    const delta = value - 0.5
    if (Math.abs(delta) > FORECASTING.RESOLVE_DELTA_THRESHOLD) {
      actualDeltas[key] = delta
    }
  }

  return {
    ...forecast,
    resolvedAt: nowISO(),
    actualOutcome: {
      peakIntensity: clamp01(peakIntensity),
      actualDuration: ticksElapsed,
      emotionDeltas: actualDeltas
    }
  }
}

export function updateAccuracy(accuracy: ForecastAccuracy, forecast: AffectiveForecast): ForecastAccuracy {
  if (!forecast.actualOutcome) return accuracy

  const intensityError = forecast.predictedIntensity - forecast.actualOutcome.peakIntensity
  const durationError = forecast.predictedDuration - forecast.actualOutcome.actualDuration

  const alpha = FORECASTING.ACCURACY_EMA_ALPHA
  const newIntensityError = accuracy.intensityError * (1 - alpha) + intensityError * alpha
  const newDurationError = accuracy.durationError * (1 - alpha) + durationError * alpha

  const accuracyScore =
    1 - clamp01((Math.abs(intensityError) + Math.abs(durationError) / FORECASTING.ACCURACY_DURATION_NORMALIZER) / 2)
  const recentAccuracies = [...accuracy.recentAccuracies, accuracyScore].slice(-FORECASTING.MAX_RECENT_ACCURACIES)

  return {
    intensityError: newIntensityError,
    durationError: newDurationError,
    totalForecasts: accuracy.totalForecasts + 1,
    recentAccuracies
  }
}

export function updateBiasStrengths(
  strengths: Record<ForecastBiasType, number>,
  accuracy: ForecastAccuracy
): Record<ForecastBiasType, number> {
  if (accuracy.recentAccuracies.length === 0) return strengths

  const avgAccuracy = accuracy.recentAccuracies.reduce((a, b) => a + b, 0) / accuracy.recentAccuracies.length
  const learningSignal = avgAccuracy * FORECASTING.BIAS_LEARNING_RATE

  return {
    impact_bias: Math.max(FORECASTING.MIN_BIAS_STRENGTH, strengths.impact_bias - learningSignal),
    focalism: Math.max(FORECASTING.MIN_BIAS_STRENGTH, strengths.focalism - learningSignal),
    immune_neglect: Math.max(FORECASTING.MIN_BIAS_STRENGTH, strengths.immune_neglect - learningSignal)
  }
}

export function computeForecastAnticipation(
  forecast: AffectiveForecast | null,
  _currentEmotion: EmotionalState
): Record<string, number> {
  if (!forecast || forecast.resolvedAt) return {}

  const deltas: Record<string, number> = {}
  for (const [key, value] of Object.entries(forecast.predictedEmotion)) {
    deltas[key] = value * FORECASTING.ANTICIPATION_MODULATION_SCALE
  }

  return deltas
}

export function shouldResolveForecast(forecast: AffectiveForecast, ticksSinceForecast: number): boolean {
  return !forecast.resolvedAt && ticksSinceForecast >= forecast.predictedDuration
}
