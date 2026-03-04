import * as z from "zod"

export const DissonanceResolution = z.enum([
  "attitude_change",
  "behavior_change",
  "new_cognition",
  "acceptance",
  "unresolved"
])
export type DissonanceResolution = z.infer<typeof DissonanceResolution>

export const DissonanceEvent = z.object({
  declaredValue: z.string(),
  actualAction: z.string(),
  dissonanceScore: z.number().min(0).max(1),
  resolution: DissonanceResolution.optional(),
  timestamp: z.string()
})
export type DissonanceEvent = z.infer<typeof DissonanceEvent>

export const ValueActionAnalysis = z.object({
  mismatches: z.array(z.object({
    declaredValue: z.string(),
    actualAction: z.string(),
    dissonanceScore: z.number().min(0).max(1)
  })).default([])
})
export type ValueActionAnalysis = z.infer<typeof ValueActionAnalysis>

export const DissonanceState = z.object({
  activeDissonance: z.number().min(0).max(1),
  recentEvents: z.array(DissonanceEvent),
  cumulativeUnresolved: z.number().min(0).max(1)
})
export type DissonanceState = z.infer<typeof DissonanceState>
