import * as z from "zod"

export const InstinctImpulse = z.enum(["approach", "avoid", "engage", "withdraw", "neutral"])
export type InstinctImpulse = z.infer<typeof InstinctImpulse>

export const InstinctImpression = z.object({
  impulse: InstinctImpulse,
  confidence: z.number().min(0).max(1),
  basis: z.string(),
  episodicMatches: z.number(),
  emotionalCharge: z.number().min(0).max(1)
})
export type InstinctImpression = z.infer<typeof InstinctImpression>

export const ConflictResolution = z.enum(["instinct_override", "reason_override", "compromise", "unresolved"])
export type ConflictResolution = z.infer<typeof ConflictResolution>

export const CognitiveConflict = z.object({
  detected: z.boolean(),
  instinctImpulse: z.string(),
  reasonDecision: z.string(),
  tensionLevel: z.number().min(0).max(1),
  resolution: ConflictResolution.optional()
})
export type CognitiveConflict = z.infer<typeof CognitiveConflict>
