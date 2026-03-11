import * as z from "zod"
import { clamp, clamp01 } from "@/infra/lib/math.ts"

export const InteractionStrategy = z.object({
  register: z.string(),
  emotionSummary: z.string(),
  dominantDrive: z.string().nullable(),
  timeOfDay: z.enum(["morning", "afternoon", "evening", "night"]),
  topicHint: z.string()
})
export type InteractionStrategy = z.infer<typeof InteractionStrategy>

export const LessonContext = z.object({
  register: z.string().optional(),
  timeOfDay: z.string().optional(),
  dominantDrive: z.string().optional(),
  operatorMood: z.string().optional()
})
export type LessonContext = z.infer<typeof LessonContext>

export const Lesson = z.object({
  id: z.string(),
  insight: z.string(),
  context: LessonContext,
  confidence: z.number().min(0).max(1),
  validationCount: z.number().default(0),
  createdAt: z.string(),
  lastValidatedAt: z.string().optional()
})
export type Lesson = z.infer<typeof Lesson>

export const StructuredInsight = z.object({
  insight: z.string(),
  applicableRegister: z.string().optional(),
  applicableTimeOfDay: z.string().optional(),
  applicableDrive: z.string().optional()
})
export type StructuredInsight = z.infer<typeof StructuredInsight>

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

  score += clamp(reaction.engagementDelta * 0.2, -0.2, 0.2)

  if (reaction.conversationContinued) score += 0.2

  return clamp01(score)
}
