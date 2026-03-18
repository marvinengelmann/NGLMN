import { clamp01 } from "@/infra/lib/math.ts"
import { nowISO } from "@/infra/lib/time.ts"
import { FEP } from "./constants.ts"
import { applyNeuromodulatorPrecisionEffects, computeBasePrecisionWeights } from "./precision.ts"
import { getFreeEnergyHistory, getFreeEnergyState } from "./state.ts"
import {
  type FreeEnergyDecomposition,
  type FreeEnergyState,
  PE_CHANNEL_NAMES,
  type PEChannelName,
  type PrecisionWeights,
  type PredictionErrorChannel
} from "./types.ts"

interface ComplexityInput {
  coherenceScore: number
  dissonanceScore: number
  activeDefenseCount: number
  forecastAccuracy: number
}

export interface FreeEnergyInput {
  interoceptiveTotalError: number
  interoceptiveAccuracy: number
  vagalZone: "ventral" | "sympathetic" | "dorsal"
  anticipatoryViolations: Array<{ surpriseIntensity: number }>
  patternConfidence: number
  surpriseLevel: number
  operatorPredictionAccuracy: number
  operatorModelConfidence: number
  coherenceIntegrationScore: number
  activeDissonance: number
  driveFrustrations: number[]
  forecastErrorLevel: number
  metacognitiveClarity: number
  cognitiveFatigue: number
  activeDefenseCount: number
  neuromodulatoryState: {
    dopamine: { level: number }
    serotonin: { level: number }
    norepinephrine: { level: number }
    oxytocin: { level: number }
    cortisol: { level: number }
    endorphins: { level: number }
  } | null
}

/**
 * Extract raw prediction errors from input into unified PE channels.
 */
export function extractPredictionErrorChannels(
  input: FreeEnergyInput,
  precisionWeights: PrecisionWeights
): PredictionErrorChannel[] {
  const rawErrors: Record<PEChannelName, number> = {
    interoceptive: input.interoceptiveTotalError,
    anticipatory: extractAnticipatoryError(input),
    novelty: clamp01(input.surpriseLevel),
    relational: clamp01(1 - input.operatorPredictionAccuracy),
    coherence: clamp01(1 - input.coherenceIntegrationScore),
    dissonance: input.activeDissonance,
    drive: extractDriveError(input),
    forecast: clamp01(input.forecastErrorLevel),
    metacognitive: clamp01(1 - input.metacognitiveClarity)
  }

  return PE_CHANNEL_NAMES.map((name) => {
    const rawError = rawErrors[name]
    const precision = precisionWeights[name]
    return {
      name,
      rawError,
      precision,
      weightedError: precision * rawError * rawError
    }
  })
}

function extractAnticipatoryError(input: FreeEnergyInput): number {
  const violations = input.anticipatoryViolations
  if (violations.length === 0) return 0
  return clamp01(Math.max(...violations.map((v) => v.surpriseIntensity)))
}

function extractDriveError(input: FreeEnergyInput): number {
  if (input.driveFrustrations.length === 0) return 0
  return clamp01(Math.max(...input.driveFrustrations))
}

/**
 * Compute the accuracy term: sum of precision-weighted squared prediction errors.
 */
export function computeAccuracyTerm(channels: PredictionErrorChannel[]): number {
  if (channels.length === 0) return 0
  const sum = channels.reduce((acc, ch) => acc + ch.weightedError, 0)
  return clamp01(sum / channels.length)
}

/**
 * Compute the complexity term: metabolic cost of maintaining distorted internal models.
 */
export function computeComplexityTerm(input: ComplexityInput): number {
  const W = FEP.COMPLEXITY_WEIGHTS
  return clamp01(
    W.COHERENCE * (1 - input.coherenceScore) +
      W.DISSONANCE * input.dissonanceScore +
      W.DEFENSE * (input.activeDefenseCount / FEP.MAX_DEFENSE_COUNT) +
      W.FORECAST_MISCALIBRATION * (1 - input.forecastAccuracy)
  )
}

/**
 * Compute total variational free energy: accuracy + complexity.
 */
export function computeFreeEnergyDecomposition(
  channels: PredictionErrorChannel[],
  complexityInput: ComplexityInput
): FreeEnergyDecomposition {
  const accuracy = computeAccuracyTerm(channels)
  const complexity = computeComplexityTerm(complexityInput)
  return {
    accuracy,
    complexity,
    total: clamp01((accuracy + complexity) / 2)
  }
}

/**
 * Update allostatic load (chronic free energy) via exponential moving average.
 */
export function computeAllostaticLoad(previousLoad: number, currentFE: number): number {
  const alpha = FEP.ALLOSTATIC_LOAD_ALPHA
  return clamp01(previousLoad * (1 - alpha) + currentFE * alpha)
}

/**
 * Compute FE trend from recent history: positive = rising, negative = falling.
 */
export function computeTrend(history: number[]): number {
  const window = FEP.TREND_WINDOW
  if (history.length < 2) return 0

  const recent = history.slice(-window)
  if (recent.length < 2) return 0

  const firstHalf = recent.slice(0, Math.floor(recent.length / 2))
  const secondHalf = recent.slice(Math.floor(recent.length / 2))

  const avgFirst = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length
  const avgSecond = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length

  return Math.max(-1, Math.min(1, (avgSecond - avgFirst) * 5))
}

/**
 * Find the channel contributing most to free energy.
 */
export function findDominantChannel(channels: PredictionErrorChannel[]): PEChannelName {
  if (channels.length === 0) return "interoceptive"

  let maxWeighted = -1
  let dominant: PEChannelName = "interoceptive"

  for (const ch of channels) {
    if (ch.weightedError > maxWeighted) {
      maxWeighted = ch.weightedError
      dominant = ch.name
    }
  }

  return dominant
}

/**
 * Compute the complete FreeEnergyState from extracted subsystem signals.
 */
export async function assembleFreeEnergyState(input: FreeEnergyInput): Promise<FreeEnergyState> {
  const forecastAccuracy = clamp01(1 - input.forecastErrorLevel)

  const basePrecisions = computeBasePrecisionWeights({
    interoceptiveAccuracy: input.interoceptiveAccuracy,
    vagalZone: input.vagalZone,
    patternConfidence: input.patternConfidence,
    metacognitiveClarity: input.metacognitiveClarity,
    operatorModelConfidence: input.operatorModelConfidence,
    coherenceIntegrationScore: input.coherenceIntegrationScore,
    cognitiveFatigue: input.cognitiveFatigue,
    forecastAccuracy
  })

  const precisionWeights = input.neuromodulatoryState
    ? applyNeuromodulatorPrecisionEffects(
        basePrecisions,
        input.neuromodulatoryState as Parameters<typeof applyNeuromodulatorPrecisionEffects>[1]
      )
    : basePrecisions

  const channels = extractPredictionErrorChannels(input, precisionWeights)

  const decomposition = computeFreeEnergyDecomposition(channels, {
    coherenceScore: input.coherenceIntegrationScore,
    dissonanceScore: input.activeDissonance,
    activeDefenseCount: input.activeDefenseCount,
    forecastAccuracy
  })

  const previousState = await getFreeEnergyState()
  const history = await getFreeEnergyHistory()
  const allostaticLoad = computeAllostaticLoad(previousState.allostaticLoad, decomposition.total)
  const fullHistory = [...history, decomposition.total]
  const trend = computeTrend(fullHistory)
  const dominantChannel = findDominantChannel(channels)

  return {
    channels,
    precisionWeights,
    decomposition,
    allostaticLoad,
    trend,
    dominantChannel,
    precisionDynamics: {
      volatilityEstimate: computeQuickVolatility(fullHistory),
      learningRateGain: 1.0,
      attentionalGain: 1.0
    },
    lastUpdatedAt: nowISO()
  }
}

function computeQuickVolatility(history: number[]): number {
  if (history.length < FEP.VOLATILITY.MIN_HISTORY) return 0.3

  const mean = history.reduce((s, v) => s + v, 0) / history.length
  if (mean < 0.001) return 0

  const variance = history.reduce((s, v) => s + (v - mean) ** 2, 0) / history.length
  const stddev = Math.sqrt(variance)
  return clamp01(Math.min(stddev / mean, FEP.VOLATILITY.MAX_COEFFICIENT))
}
