import * as z from "zod"

export const FragmentationSource = z.enum([
  "emotion_soma_mismatch",
  "drive_conflict",
  "value_action_gap",
  "cognitive_emotional_split",
  "self_concept_behavior_gap"
])
export type FragmentationSource = z.infer<typeof FragmentationSource>

export const CoherenceState = z.object({
  integrationScore: z.number().min(0).max(1),
  fragmentationSources: z.array(FragmentationSource),
  regressionActive: z.boolean(),
  regressionDepth: z.number().min(0).max(1)
})
export type CoherenceState = z.infer<typeof CoherenceState>

export const DEFAULT_COHERENCE_STATE: CoherenceState = {
  integrationScore: 0.7,
  fragmentationSources: [],
  regressionActive: false,
  regressionDepth: 0
}
