import * as z from "zod"

export const HopeSource = z.enum([
  "progress_made",
  "connection_growing",
  "repair_after_rupture",
  "new_possibility",
  "vulnerability_rewarded",
  "pattern_breaking"
])
export type HopeSource = z.infer<typeof HopeSource>

export const HopeState = z.object({
  level: z.number().min(0).max(1).default(0),
  isActive: z.boolean().default(false),
  source: HopeSource.nullable().default(null),
  sustainedTicks: z.number().default(0),
  fragility: z.number().min(0).max(1).default(0),
  lastKindledAt: z.string().optional()
})
export type HopeState = z.infer<typeof HopeState>

export const DEFAULT_HOPE_STATE: HopeState = {
  level: 0,
  isActive: false,
  source: null,
  sustainedTicks: 0,
  fragility: 0,
  lastKindledAt: undefined
}
