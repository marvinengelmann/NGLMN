import * as z from "zod"

export const DistortionType = z.enum([
  "detail_alteration",
  "temporal_confusion",
  "episode_conflation",
  "emotional_recoloring",
  "source_confusion",
  "confidence_degradation"
])
export type DistortionType = z.infer<typeof DistortionType>

export const DistortionRecord = z.object({
  type: DistortionType,
  originalEpisodeId: z.string(),
  alteredField: z.string()
})
export type DistortionRecord = z.infer<typeof DistortionRecord>

export const DetailAlterationResult = z.object({
  alteredText: z.string()
})
export type DetailAlterationResult = z.infer<typeof DetailAlterationResult>

export const EmotionalRecoloringResult = z.object({
  recoloring: z.string()
})
export type EmotionalRecoloringResult = z.infer<typeof EmotionalRecoloringResult>

export const DistortedMemory = z.object({
  id: z.string(),
  score: z.number(),
  data: z.string().optional(),
  metadata: z.any().optional(),
  distortions: z.array(DistortionRecord).default([])
})
export type DistortedMemory = z.infer<typeof DistortedMemory>
