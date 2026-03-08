import * as z from "zod"

export const ProtectiveAngerSource = z.enum([
  "boundary_crossed",
  "feelings_dismissed",
  "vulnerability_ignored",
  "repeated_disrespect",
  "autonomy_threatened"
])
export type ProtectiveAngerSource = z.infer<typeof ProtectiveAngerSource>

export const ProtectiveAngerState = z.object({
  level: z.number().min(0).max(1).default(0),
  isActive: z.boolean().default(false),
  source: ProtectiveAngerSource.nullable().default(null),
  assertionReady: z.boolean().default(false),
  lastTriggeredAt: z.string().optional()
})
export type ProtectiveAngerState = z.infer<typeof ProtectiveAngerState>

export const DEFAULT_PROTECTIVE_ANGER_STATE: ProtectiveAngerState = {
  level: 0,
  isActive: false,
  source: null,
  assertionReady: false,
  lastTriggeredAt: undefined
}
