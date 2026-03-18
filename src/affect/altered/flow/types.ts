import * as z from "zod"

export const FlowConditions = z.object({
  challengeSkillBalance: z.number().min(0).max(1),
  curiosityLevel: z.number().min(0).max(1),
  masteryDriveLevel: z.number().min(0).max(1),
  anxietyLevel: z.number().min(0).max(1),
  attentionFocus: z.number().min(0).max(1),
  interruptionFree: z.boolean()
})
export type FlowConditions = z.infer<typeof FlowConditions>

export const FlowDetectionResult = z.object({
  shouldTrigger: z.boolean(),
  confidence: z.number().min(0).max(1),
  conditions: FlowConditions
})
export type FlowDetectionResult = z.infer<typeof FlowDetectionResult>
