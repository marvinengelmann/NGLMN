import { createStateManager } from "@/infra/lib/state.ts"
import { CreativeUrgeState, DEFAULT_CREATIVE_URGE_STATE } from "./types.ts"

export const { get: getCreativeUrgeState, save: saveCreativeUrgeState } = createStateManager(
  "working:creativity:urge",
  CreativeUrgeState,
  DEFAULT_CREATIVE_URGE_STATE
)
