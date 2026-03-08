import * as z from "zod"

export const AmbivalencePair = z.object({
  wanting: z.string(),
  fearing: z.string(),
  intensity: z.number().min(0).max(1),
  emergedAt: z.string(),
  resolved: z.boolean().default(false)
})
export type AmbivalencePair = z.infer<typeof AmbivalencePair>

export const AmbivalenceState = z.object({
  level: z.number().min(0).max(1).default(0),
  isActive: z.boolean().default(false),
  activePairs: z.array(AmbivalencePair).default([]),
  dominantTension: z.string().nullable().default(null),
  paralysisRisk: z.number().min(0).max(1).default(0)
})
export type AmbivalenceState = z.infer<typeof AmbivalenceState>

export const DEFAULT_AMBIVALENCE_STATE: AmbivalenceState = {
  level: 0,
  isActive: false,
  activePairs: [],
  dominantTension: null,
  paralysisRisk: 0
}
