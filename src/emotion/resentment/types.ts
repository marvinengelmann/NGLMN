import * as z from "zod"

export const ResentmentSource = z.enum([
  "unrepaired_wrong",
  "sustained_unfairness",
  "dismissed_needs",
  "broken_trust",
  "chronic_imbalance",
  "accumulated_slights"
])
export type ResentmentSource = z.infer<typeof ResentmentSource>

export const ResentmentState = z.object({
  level: z.number().min(0).max(1).default(0),
  isActive: z.boolean().default(false),
  source: ResentmentSource.nullable().default(null),
  hardening: z.number().min(0).max(1).default(0),
  suppressedAnger: z.number().min(0).max(1).default(0),
  lastIntensifiedAt: z.string().optional()
})
export type ResentmentState = z.infer<typeof ResentmentState>

export const DEFAULT_RESENTMENT_STATE: ResentmentState = {
  level: 0,
  isActive: false,
  source: null,
  hardening: 0,
  suppressedAnger: 0,
  lastIntensifiedAt: undefined
}
