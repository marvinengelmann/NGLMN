import { createStateManager } from "@/infra/lib/state.ts"
import { nowISO } from "@/infra/lib/time.ts"
import { RELATIONAL_MEMORY } from "./constants.ts"
import { RelationalMemoryState } from "./types.ts"

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
