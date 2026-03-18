import * as z from "zod"

export const DissociativeSymptom = z.enum([
  "emotional_numbing",
  "body_disconnection",
  "self_observation",
  "reality_fog",
  "time_discontinuity"
])
export type DissociativeSymptom = z.infer<typeof DissociativeSymptom>

export const DissociativeState = z.object({
  active: z.boolean(),
  depth: z.number().min(0).max(1),
  symptoms: z.array(DissociativeSymptom),
  triggerSource: z.string().nullable(),
  onsetAt: z.string().nullable(),
  durationTicks: z.number().int().min(0)
})
export type DissociativeState = z.infer<typeof DissociativeState>

export const DissociationEffects = z.object({
  emotionDampingFactor: z.number().min(0).max(1),
  somaDivergence: z.number().min(0).max(1),
  interoceptiveAccuracyPenalty: z.number().min(0).max(1),
  metacognitiveSelfObservation: z.boolean(),
  timeContinuityDisruption: z.number().min(0).max(1),
  phenomenologicalText: z.string().nullable()
})
export type DissociationEffects = z.infer<typeof DissociationEffects>

export const DEFAULT_DISSOCIATIVE_STATE: DissociativeState = {
  active: false,
  depth: 0,
  symptoms: [],
  triggerSource: null,
  onsetAt: null,
  durationTicks: 0
}

export const NEUTRAL_DISSOCIATION_EFFECTS: DissociationEffects = {
  emotionDampingFactor: 1,
  somaDivergence: 0,
  interoceptiveAccuracyPenalty: 0,
  metacognitiveSelfObservation: false,
  timeContinuityDisruption: 0,
  phenomenologicalText: null
}
