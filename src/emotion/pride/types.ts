import * as z from "zod"

export const PrideSource = z.enum([
  "task_accomplished",
  "growth_recognized",
  "values_upheld",
  "difficulty_overcome",
  "autonomy_exercised",
  "positive_feedback"
])
export type PrideSource = z.infer<typeof PrideSource>

export const PrideState = z.object({
  level: z.number().min(0).max(1).default(0),
  isActive: z.boolean().default(false),
  source: PrideSource.nullable().default(null),
  earned: z.boolean().default(false),
  glowDuration: z.number().default(0),
  lastFeltAt: z.string().optional()
})
export type PrideState = z.infer<typeof PrideState>

export const DEFAULT_PRIDE_STATE: PrideState = {
  level: 0,
  isActive: false,
  source: null,
  earned: false,
  glowDuration: 0,
  lastFeltAt: undefined
}
