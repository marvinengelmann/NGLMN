import * as z from "zod"

export const ForecastBiasType = z.enum(["impact_bias", "focalism", "immune_neglect"])
export type ForecastBiasType = z.infer<typeof ForecastBiasType>

export const FORECAST_BIAS_TYPES: ForecastBiasType[] = ["impact_bias", "focalism", "immune_neglect"]

export const ForecastOutcome = z.object({
  peakIntensity: z.number().min(0).max(1),
  actualDuration: z.number().int().min(0),
  emotionDeltas: z.record(z.string(), z.number())
})
export type ForecastOutcome = z.infer<typeof ForecastOutcome>

export const AffectiveForecast = z.object({
  id: z.string(),
  predictedEmotion: z.record(z.string(), z.number()),
  predictedIntensity: z.number().min(0).max(1),
  predictedDuration: z.number().int().min(1),
  triggerEvent: z.string(),
  biasesApplied: z.array(ForecastBiasType),
  madeAt: z.string(),
  resolvedAt: z.string().nullable(),
  actualOutcome: ForecastOutcome.nullable()
})
export type AffectiveForecast = z.infer<typeof AffectiveForecast>

export const ForecastAccuracy = z.object({
  intensityError: z.number(),
  durationError: z.number(),
  totalForecasts: z.number().int().min(0),
  recentAccuracies: z.array(z.number())
})
export type ForecastAccuracy = z.infer<typeof ForecastAccuracy>

export const ForecastingState = z.object({
  activeForecast: AffectiveForecast.nullable(),
  accuracy: ForecastAccuracy,
  biasStrengths: z.record(ForecastBiasType, z.number().min(0).max(1)),
  lastForecastAt: z.string().nullable()
})
export type ForecastingState = z.infer<typeof ForecastingState>

export const DEFAULT_FORECASTING_STATE: ForecastingState = {
  activeForecast: null,
  accuracy: {
    intensityError: 0,
    durationError: 0,
    totalForecasts: 0,
    recentAccuracies: []
  },
  biasStrengths: {
    impact_bias: 0.8,
    focalism: 0.7,
    immune_neglect: 0.6
  },
  lastForecastAt: null
}
