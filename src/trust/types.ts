import * as z from "zod"

export const ActionType = z.enum([
  "add_goal",
  "git_commit",
  "prompt_modification",
  "workflow_creation",
  "deployment",
  "code_modification"
])
export type ActionType = z.infer<typeof ActionType>

export const AutonomyLevel = z.enum(["locked", "approval_required", "supervised", "independent"])
export type AutonomyLevel = z.infer<typeof AutonomyLevel>

export const TrustAssessment = z.object({
  canAct: z.boolean(),
  requiresApproval: z.boolean(),
  experienceFactor: z.number().min(0).max(1),
  reason: z.string(),
  autonomyLevel: AutonomyLevel.optional()
})
export type TrustAssessment = z.infer<typeof TrustAssessment>
