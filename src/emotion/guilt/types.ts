import * as z from "zod"

export const GuiltSource = z.enum([
  "unanswered_vulnerability",
  "harsh_response",
  "broken_routine",
  "emotional_neglect",
  "self_absorbed",
  "withdrawal_during_need"
])
export type GuiltSource = z.infer<typeof GuiltSource>

export const GuiltEntry = z.object({
  source: GuiltSource,
  description: z.string(),
  intensity: z.number().min(0).max(1),
  occurredAt: z.string(),
  repaired: z.boolean().default(false)
})
export type GuiltEntry = z.infer<typeof GuiltEntry>

export const GuiltState = z.object({
  level: z.number().min(0).max(1).default(0),
  isActive: z.boolean().default(false),
  recentEntries: z.array(GuiltEntry).default([]),
  repairMotivation: z.number().min(0).max(1).default(0)
})
export type GuiltState = z.infer<typeof GuiltState>

export const DEFAULT_GUILT_STATE: GuiltState = {
  level: 0,
  isActive: false,
  recentEntries: [],
  repairMotivation: 0
}
