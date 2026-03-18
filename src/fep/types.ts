import * as z from "zod"

export const PE_CHANNEL_NAMES = [
  "interoceptive",
  "anticipatory",
  "novelty",
  "relational",
  "coherence",
  "dissonance",
  "drive",
  "forecast",
  "metacognitive"
] as const

export const PEChannelName = z.enum(PE_CHANNEL_NAMES)
export type PEChannelName = z.infer<typeof PEChannelName>

export const PredictionErrorChannel = z.object({
  name: PEChannelName,
  rawError: z.number().min(0).max(1),
  precision: z.number().min(0).max(1),
  weightedError: z.number().min(0)
})
export type PredictionErrorChannel = z.infer<typeof PredictionErrorChannel>

export const PrecisionWeights = z.object({
  interoceptive: z.number().min(0).max(1),
  anticipatory: z.number().min(0).max(1),
  novelty: z.number().min(0).max(1),
  relational: z.number().min(0).max(1),
  coherence: z.number().min(0).max(1),
  dissonance: z.number().min(0).max(1),
  drive: z.number().min(0).max(1),
  forecast: z.number().min(0).max(1),
  metacognitive: z.number().min(0).max(1)
})
export type PrecisionWeights = z.infer<typeof PrecisionWeights>

export const FreeEnergyDecomposition = z.object({
  accuracy: z.number().min(0),
  complexity: z.number().min(0),
  total: z.number().min(0)
})
export type FreeEnergyDecomposition = z.infer<typeof FreeEnergyDecomposition>

export const ActiveInferenceSignal = z.object({
  expectedFEReduction: z.record(z.string(), z.number()),
  preferredAction: z.string().nullable(),
  explorationBonus: z.number().min(0).max(1),
  exploitationPull: z.number().min(0).max(1)
})
export type ActiveInferenceSignal = z.infer<typeof ActiveInferenceSignal>

export const PrecisionDynamics = z.object({
  volatilityEstimate: z.number().min(0).max(1),
  learningRateGain: z.number().min(0).max(2),
  attentionalGain: z.number().min(0).max(2)
})
export type PrecisionDynamics = z.infer<typeof PrecisionDynamics>

export const FreeEnergyState = z.object({
  channels: z.array(PredictionErrorChannel),
  precisionWeights: PrecisionWeights,
  decomposition: FreeEnergyDecomposition,
  allostaticLoad: z.number().min(0).max(1),
  trend: z.number().min(-1).max(1),
  dominantChannel: PEChannelName,
  precisionDynamics: PrecisionDynamics,
  lastUpdatedAt: z.string()
})
export type FreeEnergyState = z.infer<typeof FreeEnergyState>

export const DEFAULT_PRECISION_WEIGHTS: PrecisionWeights = {
  interoceptive: 0.5,
  anticipatory: 0.5,
  novelty: 0.5,
  relational: 0.5,
  coherence: 0.7,
  dissonance: 0.5,
  drive: 0.5,
  forecast: 0.5,
  metacognitive: 0.7
}

export const DEFAULT_FREE_ENERGY_STATE: FreeEnergyState = {
  channels: [],
  precisionWeights: DEFAULT_PRECISION_WEIGHTS,
  decomposition: { accuracy: 0, complexity: 0, total: 0 },
  allostaticLoad: 0,
  trend: 0,
  dominantChannel: "interoceptive",
  precisionDynamics: {
    volatilityEstimate: 0.3,
    learningRateGain: 1.0,
    attentionalGain: 1.0
  },
  lastUpdatedAt: new Date().toISOString()
}
