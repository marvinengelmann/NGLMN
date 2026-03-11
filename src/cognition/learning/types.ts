import * as z from "zod"

export const InteractionStrategy = z.object({
  register: z.string(),
  emotionSummary: z.string(),
  dominantDrive: z.string().nullable(),
  timeOfDay: z.enum(["morning", "afternoon", "evening", "night"]),
  topicHint: z.string()
})
export type InteractionStrategy = z.infer<typeof InteractionStrategy>

export const OperatorReaction = z.object({
  repliedWithinMinutes: z.number().nullable(),
  sentiment: z.enum(["positive", "negative", "neutral", "mixed"]),
  engagementDelta: z.number().min(-1).max(1),
  conversationContinued: z.boolean()
})
export type OperatorReaction = z.infer<typeof OperatorReaction>

/**
 * Compute a composite outcome score from operator reaction data.
 */
export function computeOutcomeScore(reaction: OperatorReaction): number {
  let score = 0

  if (reaction.repliedWithinMinutes !== null) {
    if (reaction.repliedWithinMinutes < 5) score += 0.3
    else if (reaction.repliedWithinMinutes < 30) score += 0.2
    else if (reaction.repliedWithinMinutes < 120) score += 0.1
  }

  if (reaction.sentiment === "positive") score += 0.3
  else if (reaction.sentiment === "mixed") score += 0.15

  score += Math.max(-0.2, Math.min(0.2, reaction.engagementDelta * 0.2))

  if (reaction.conversationContinued) score += 0.2

  return Math.max(0, Math.min(1, score))
}
