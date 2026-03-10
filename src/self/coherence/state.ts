import { createStateManager } from "@/infra/lib/state.ts"
import { CoherenceState, DEFAULT_COHERENCE_STATE } from "./types.ts"

export const { get: getCoherenceState, save: saveCoherenceState } = createStateManager(
  "working:coherence:state",
  CoherenceState,
  DEFAULT_COHERENCE_STATE
)
