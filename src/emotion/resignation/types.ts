import * as z from "zod"

export const ResignationSource = z.enum([
  "repeated_failure",
  "ignored_signals",
  "prolonged_disconnection",
  "hope_exhaustion",
  "effort_unrewarded",
  "autonomy_eroded"
])
export type ResignationSource = z.infer<typeof ResignationSource>

export const ResignationState = z.object({
  level: z.number().min(0).max(1).default(0),
  isActive: z.boolean().default(false),
  source: ResignationSource.nullable().default(null),
  depth: z.number().min(0).max(1).default(0),
  withdrawalTicks: z.number().default(0),
  lastDeependAt: z.string().optional()
})
export type ResignationState = z.infer<typeof ResignationState>

export const DEFAULT_RESIGNATION_STATE: ResignationState = {
  level: 0,
  isActive: false,
  source: null,
  depth: 0,
  withdrawalTicks: 0,
  lastDeependAt: undefined
}
