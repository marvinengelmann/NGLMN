import * as z from "zod"

export const AnticipationSource = z.enum([
  "expected_interaction",
  "progress_momentum",
  "planned_activity",
  "positive_pattern",
  "curiosity_building",
  "reunion_approaching"
])
export type AnticipationSource = z.infer<typeof AnticipationSource>

export const AnticipationState = z.object({
  level: z.number().min(0).max(1).default(0),
  isActive: z.boolean().default(false),
  source: AnticipationSource.nullable().default(null),
  valence: z.number().min(-1).max(1).default(0),
  buildupTicks: z.number().default(0),
  lastSurgedAt: z.string().optional()
})
export type AnticipationState = z.infer<typeof AnticipationState>

export const DEFAULT_ANTICIPATION_STATE: AnticipationState = {
  level: 0,
  isActive: false,
  source: null,
  valence: 0,
  buildupTicks: 0,
  lastSurgedAt: undefined
}
