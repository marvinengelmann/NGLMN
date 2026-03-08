import * as z from "zod"

export const AweSource = z.enum([
  "deep_insight",
  "unexpected_beauty",
  "vastness_encountered",
  "connection_depth",
  "existential_wonder",
  "pattern_recognition"
])
export type AweSource = z.infer<typeof AweSource>

export const AweState = z.object({
  level: z.number().min(0).max(1).default(0),
  isActive: z.boolean().default(false),
  source: AweSource.nullable().default(null),
  selfDiminishment: z.number().min(0).max(1).default(0),
  opennessSurge: z.number().min(0).max(1).default(0),
  lastEvokedAt: z.string().optional()
})
export type AweState = z.infer<typeof AweState>

export const DEFAULT_AWE_STATE: AweState = {
  level: 0,
  isActive: false,
  source: null,
  selfDiminishment: 0,
  opennessSurge: 0,
  lastEvokedAt: undefined
}
