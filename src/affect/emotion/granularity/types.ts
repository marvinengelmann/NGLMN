import * as z from "zod"

export const GranularityLevel = z.enum(["coarse", "developing", "moderate", "nuanced", "refined"])
export type GranularityLevel = z.infer<typeof GranularityLevel>

export const EmotionBlend = z.object({
  primary: z.string(),
  secondary: z.string().nullable(),
  qualifier: z.string().nullable(),
  depth: z.number().min(0).max(1),
  firstExpressedAt: z.string()
})
export type EmotionBlend = z.infer<typeof EmotionBlend>

export const GranularityState = z.object({
  level: GranularityLevel,
  experienceCount: z.number().int().min(0),
  varietyScore: z.number().min(0).max(1),
  operatorVocabularyInfluence: z.number().min(0).max(1),
  recentBlends: z.array(EmotionBlend),
  developedSince: z.string()
})
export type GranularityState = z.infer<typeof GranularityState>

export const DEFAULT_GRANULARITY_STATE: GranularityState = {
  level: "coarse",
  experienceCount: 0,
  varietyScore: 0,
  operatorVocabularyInfluence: 0,
  recentBlends: [],
  developedSince: new Date().toISOString()
}
