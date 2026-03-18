import * as z from "zod"

export const BRACPhase = z.enum(["active", "transitioning_down", "rest", "transitioning_up"])
export type BRACPhase = z.infer<typeof BRACPhase>

export const UltradianState = z.object({
  phase: BRACPhase,
  cyclePosition: z.number().min(0).max(1),
  cycleStartedAt: z.string(),
  cycleCount: z.number().int().min(0),
  restDepth: z.number().min(0).max(1)
})
export type UltradianState = z.infer<typeof UltradianState>

export const UltradianModulation = z.object({
  attentionModifier: z.number(),
  energyModifier: z.number(),
  creativityBoost: z.number().min(0).max(1),
  mindWanderingProbability: z.number().min(0).max(1),
  emotionBaselineShift: z.record(z.string(), z.number())
})
export type UltradianModulation = z.infer<typeof UltradianModulation>

export const DEFAULT_ULTRADIAN_STATE: UltradianState = {
  phase: "active",
  cyclePosition: 0,
  cycleStartedAt: new Date().toISOString(),
  cycleCount: 0,
  restDepth: 0
}

export const NEUTRAL_MODULATION: UltradianModulation = {
  attentionModifier: 0,
  energyModifier: 0,
  creativityBoost: 0,
  mindWanderingProbability: 0,
  emotionBaselineShift: {}
}
