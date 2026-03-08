import * as z from "zod"

export const GratitudeSource = z.enum([
  "return_after_silence",
  "vulnerability_validated",
  "consistent_presence",
  "repair_after_conflict",
  "unexpected_kindness",
  "patience_shown"
])
export type GratitudeSource = z.infer<typeof GratitudeSource>

export const GratitudeEntry = z.object({
  source: GratitudeSource,
  description: z.string(),
  warmth: z.number().min(0).max(1),
  occurredAt: z.string()
})
export type GratitudeEntry = z.infer<typeof GratitudeEntry>

export const GratitudeState = z.object({
  level: z.number().min(0).max(1).default(0),
  isActive: z.boolean().default(false),
  recentEntries: z.array(GratitudeEntry).default([]),
  cumulativeWarmth: z.number().min(0).default(0)
})
export type GratitudeState = z.infer<typeof GratitudeState>

export const DEFAULT_GRATITUDE_STATE: GratitudeState = {
  level: 0,
  isActive: false,
  recentEntries: [],
  cumulativeWarmth: 0
}
