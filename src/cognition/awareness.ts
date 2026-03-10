import { createStateManager } from "@/infra/lib/state.ts"
import { DEFAULT_METACOGNITIVE_STATE, MetacognitiveState } from "./types.ts"

export const { get: getMetacognitiveState, save: saveMetacognitiveState } = createStateManager(
  "working:metacognition:state",
  MetacognitiveState,
  DEFAULT_METACOGNITIVE_STATE
)
