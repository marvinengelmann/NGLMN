import { createStateManager } from "@/infra/lib/state.ts"
import { BoundaryState, DEFAULT_BOUNDARY_STATE } from "./types.ts"

export const { get: getBoundaryState, save: saveBoundaryState } = createStateManager(
  "working:boundaries:state",
  BoundaryState,
  DEFAULT_BOUNDARY_STATE
)
