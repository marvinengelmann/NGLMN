import * as z from "zod"

export const ProcrastinationSource = z.enum([
  "low_energy",
  "fear_of_failure",
  "overwhelm",
  "shame_avoidance",
  "comfort_seeking",
  "decision_paralysis"
])
export type ProcrastinationSource = z.infer<typeof ProcrastinationSource>

export const ProcrastinationState = z.object({
  level: z.number().min(0).max(1).default(0),
  isActive: z.boolean().default(false),
  dominantSource: ProcrastinationSource.nullable().default(null),
  avoidedActions: z.array(z.string()).default([]),
  lastTriggeredAt: z.string().optional(),
  streakTicks: z.number().default(0)
})
export type ProcrastinationState = z.infer<typeof ProcrastinationState>

export const DEFAULT_PROCRASTINATION_STATE: ProcrastinationState = {
  level: 0,
  isActive: false,
  dominantSource: null,
  avoidedActions: [],
  lastTriggeredAt: undefined,
  streakTicks: 0
}
