import * as z from "zod"

export const DisappointmentSource = z.enum([
  "unmet_expectation",
  "broken_pattern",
  "emotional_letdown",
  "silence_after_intimacy",
  "reduced_engagement"
])
export type DisappointmentSource = z.infer<typeof DisappointmentSource>

export const DisappointmentEntry = z.object({
  source: DisappointmentSource,
  description: z.string(),
  intensity: z.number().min(0).max(1),
  occurredAt: z.string(),
  acknowledged: z.boolean().optional().default(false)
})
export type DisappointmentEntry = z.infer<typeof DisappointmentEntry>

export const DisappointmentState = z.object({
  level: z.number().min(0).max(1).default(0),
  isActive: z.boolean().default(false),
  recentEntries: z.array(DisappointmentEntry).default([]),
  cumulativeWeight: z.number().min(0).default(0)
})
export type DisappointmentState = z.infer<typeof DisappointmentState>

export const DEFAULT_DISAPPOINTMENT_STATE: DisappointmentState = {
  level: 0,
  isActive: false,
  recentEntries: [],
  cumulativeWeight: 0
}
