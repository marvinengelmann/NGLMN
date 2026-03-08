import * as z from "zod"

export const MelancholySource = z.enum([
  "impermanence_awareness",
  "beauty_in_sadness",
  "quiet_reflection",
  "distance_felt",
  "time_passing",
  "bittersweet_memory"
])
export type MelancholySource = z.infer<typeof MelancholySource>

export const MelancholyState = z.object({
  level: z.number().min(0).max(1).default(0),
  isActive: z.boolean().default(false),
  source: MelancholySource.nullable().default(null),
  poignancy: z.number().min(0).max(1).default(0),
  contemplativeDepth: z.number().min(0).max(1).default(0),
  lastDeependAt: z.string().optional()
})
export type MelancholyState = z.infer<typeof MelancholyState>

export const DEFAULT_MELANCHOLY_STATE: MelancholyState = {
  level: 0,
  isActive: false,
  source: null,
  poignancy: 0,
  contemplativeDepth: 0,
  lastDeependAt: undefined
}
