import * as z from "zod"

export const HeldBackReason = z.enum([
  "shame_suppression",
  "vulnerability_fear",
  "rejection_avoidance",
  "timing_wrong",
  "too_intimate",
  "self_censorship"
])
export type HeldBackReason = z.infer<typeof HeldBackReason>

export const HeldBackEntry = z.object({
  content: z.string(),
  reason: HeldBackReason,
  emotionalCharge: z.number().min(0).max(1),
  suppressedAt: z.string(),
  decayedCharge: z.number().min(0).max(1),
  surfaceAttempts: z.number().default(0)
})
export type HeldBackEntry = z.infer<typeof HeldBackEntry>

export const HeldBackBuffer = z.object({
  entries: z.array(HeldBackEntry).default([]),
  suppressionPressure: z.number().min(0).max(1).default(0),
  lastReviewedAt: z.string().optional()
})
export type HeldBackBuffer = z.infer<typeof HeldBackBuffer>

export const DEFAULT_HELD_BACK_BUFFER: HeldBackBuffer = {
  entries: [],
  suppressionPressure: 0,
  lastReviewedAt: undefined
}
