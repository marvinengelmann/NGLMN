import * as z from "zod"

export const EmotionRegulationStrategy = z.enum([
  "suppression",
  "attribution_bias",
  "reappraisal",
  "behavioral_activation",
  "expressive_suppression",
  "distancing",
  "selective_attention",
  "situation_modification"
])
export type EmotionRegulationStrategy = z.infer<typeof EmotionRegulationStrategy>

export const SuppressionTarget = z.object({
  episodeQuery: z.string(),
  suppressionFactor: z.number().min(0).max(1),
  addedAt: z.string()
})
export type SuppressionTarget = z.infer<typeof SuppressionTarget>

export const ActiveStrategy = z.object({
  type: EmotionRegulationStrategy,
  trigger: z.string(),
  intensity: z.number().min(0).max(1),
  activatedAt: z.string(),
  targetOverride: z.string().optional(),
  expressionModifier: z.string().optional()
})
export type ActiveStrategy = z.infer<typeof ActiveStrategy>

export const EmotionRegulationState = z.object({
  activeStrategies: z.array(ActiveStrategy),
  suppressionTargets: z.array(SuppressionTarget),
  totalActivations: z.number().int().min(0),
  totalBreakthroughs: z.number().int().min(0)
})
export type EmotionRegulationState = z.infer<typeof EmotionRegulationState>

export const DEFAULT_EMOTION_REGULATION_STATE: EmotionRegulationState = {
  activeStrategies: [],
  suppressionTargets: [],
  totalActivations: 0,
  totalBreakthroughs: 0
}
