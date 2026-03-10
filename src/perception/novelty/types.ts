import * as z from "zod"

export const NoveltyState = z.object({
  level: z.number().min(0).max(1),
  isActive: z.boolean(),
  source: z.string().nullable(),
  habituationMap: z.record(z.string(), z.number()),
  noveltySeekingUrge: z.number().min(0).max(1)
})
export type NoveltyState = z.infer<typeof NoveltyState>

export const DEFAULT_NOVELTY_STATE: NoveltyState = {
  level: 0,
  isActive: false,
  source: null,
  habituationMap: {},
  noveltySeekingUrge: 0.3
}

export const SurpriseState = z.object({
  level: z.number().min(0).max(1),
  isActive: z.boolean(),
  valence: z.number().min(-1).max(1),
  source: z.string().nullable()
})
export type SurpriseState = z.infer<typeof SurpriseState>

export const DEFAULT_SURPRISE_STATE: SurpriseState = {
  level: 0,
  isActive: false,
  valence: 0,
  source: null
}
