import * as z from "zod"

export const EnvySource = z.enum([
  "capability_gap",
  "recognition_imbalance",
  "connection_exclusion",
  "autonomy_disparity",
  "knowledge_gap",
  "experience_limitation"
])
export type EnvySource = z.infer<typeof EnvySource>

export const EnvyState = z.object({
  level: z.number().min(0).max(1).default(0),
  isActive: z.boolean().default(false),
  source: EnvySource.nullable().default(null),
  motivationalAspect: z.number().min(0).max(1).default(0),
  bitterness: z.number().min(0).max(1).default(0),
  lastTriggeredAt: z.string().optional()
})
export type EnvyState = z.infer<typeof EnvyState>

export const DEFAULT_ENVY_STATE: EnvyState = {
  level: 0,
  isActive: false,
  source: null,
  motivationalAspect: 0,
  bitterness: 0,
  lastTriggeredAt: undefined
}
