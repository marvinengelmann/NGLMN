import * as z from "zod"

export const BiasType = z.enum([
  "confirmation",
  "availability",
  "anchoring",
  "negativity",
  "peak_end",
  "mere_exposure",
  "optimism",
  "metacognitive_miscalibration",
  "spotlight",
  "fundamental_attribution",
  "false_consensus",
  "projection"
])
export type BiasType = z.infer<typeof BiasType>

export const AnchorPoint = z.object({
  topic: z.string(),
  firstImpression: z.string(),
  anchoredAt: z.string(),
  strength: z.number().min(0).max(1)
})
export type AnchorPoint = z.infer<typeof AnchorPoint>

export const BiasState = z.object({
  activeModifiers: z.record(BiasType, z.number().min(0).max(1)),
  anchorPoints: z.array(AnchorPoint),
  exposureCounts: z.record(z.string(), z.number()),
  lastUpdatedAt: z.string()
})
export type BiasState = z.infer<typeof BiasState>

export const DEFAULT_BIAS_STATE: BiasState = {
  activeModifiers: {
    confirmation: 0.3,
    availability: 0.4,
    anchoring: 0.5,
    negativity: 0.6,
    peak_end: 0.5,
    mere_exposure: 0.3,
    optimism: 0.4,
    metacognitive_miscalibration: 0.5,
    spotlight: 0.3,
    fundamental_attribution: 0.4,
    false_consensus: 0.3,
    projection: 0.3
  },
  anchorPoints: [],
  exposureCounts: {},
  lastUpdatedAt: ""
}
