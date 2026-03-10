import { createStateManager } from "@/infra/lib/state.ts"
import { AnticipatoryState, DEFAULT_ANTICIPATORY_STATE } from "./types.ts"

export const { get: getAnticipatoryState, save: saveAnticipatoryState } = createStateManager(
  "working:anticipation:state",
  AnticipatoryState,
  DEFAULT_ANTICIPATORY_STATE
)
