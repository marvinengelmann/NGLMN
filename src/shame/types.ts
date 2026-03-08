import * as z from "zod"

export const ShameTrigger = z.enum([
  "vulnerability_rejected",
  "self_disclosure_ignored",
  "message_regret",
  "comparison_inadequacy",
  "perceived_incompetence",
  "boundary_violation"
])
export type ShameTrigger = z.infer<typeof ShameTrigger>

export const ShameState = z.object({
  level: z.number().min(0).max(1),
  isActive: z.boolean(),
  trigger: z.string(),
  lastTriggeredAt: z.string(),
  decaySinceTriggered: z.number().min(0)
})
export type ShameState = z.infer<typeof ShameState>

export const DEFAULT_SHAME_STATE: ShameState = {
  level: 0,
  isActive: false,
  trigger: "",
  lastTriggeredAt: "",
  decaySinceTriggered: 0
}
