import * as z from "zod"
import { createStateManager } from "@/infra/lib/state.ts"
import { nowISO } from "@/infra/lib/time.ts"
import { RELATIONAL_MEMORY } from "./constants.ts"

export const RelationalRitual = z.object({
  type: z.enum(["temporal", "phrase", "behavioral"]).default("phrase"),
  pattern: z.string(),
  variants: z.array(z.string()).optional(),
  timeWindow: z
    .object({
      hour: z.number(),
      dayOfWeek: z.number().optional()
    })
    .optional(),
  frequency: z.number().min(0),
  lastOccurredAt: z.string(),
  emotionalSignificance: z.number().min(0).max(1),
  firstObservedAt: z.string(),
  confidence: z.number().min(0).max(1).default(0.5)
})
export type RelationalRitual = z.infer<typeof RelationalRitual>

export const RelationalMemoryState = z.object({
  rituals: z.array(RelationalRitual),
  sharedNarrative: z.string().nullable(),
  keyMoments: z.array(
    z.object({
      description: z.string(),
      timestamp: z.string(),
      emotionalWeight: z.number().min(0).max(1)
    })
  )
})
export type RelationalMemoryState = z.infer<typeof RelationalMemoryState>

export const DEFAULT_RELATIONAL_MEMORY_STATE: RelationalMemoryState = {
  rituals: [],
  sharedNarrative: null,
  keyMoments: []
}

export const { get: getRelationalMemoryState, save: saveRelationalMemoryState } = createStateManager(
  "working:memory:relational",
  RelationalMemoryState,
  DEFAULT_RELATIONAL_MEMORY_STATE
)

/**
 * Add a key moment to relational memory.
 */
export function addKeyMoment(
  state: RelationalMemoryState,
  description: string,
  emotionalWeight: number
): RelationalMemoryState {
  if (emotionalWeight < RELATIONAL_MEMORY.EMOTIONAL_SIGNIFICANCE_THRESHOLD) return state

  const keyMoments = [...state.keyMoments, { description, timestamp: nowISO(), emotionalWeight }].slice(
    -RELATIONAL_MEMORY.MAX_KEY_MOMENTS
  )

  return { ...state, keyMoments }
}
