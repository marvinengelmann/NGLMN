import { createStateManager } from "@/infra/lib/state.ts"
import { DEFAULT_NOVELTY_STATE, DEFAULT_SURPRISE_STATE, NoveltyState, SurpriseState } from "./types.ts"

export const { get: getNoveltyState, save: saveNoveltyState } = createStateManager(
  "working:novelty:state",
  NoveltyState,
  DEFAULT_NOVELTY_STATE
)

export const { get: getSurpriseState, save: saveSurpriseState } = createStateManager(
  "working:novelty:surprise",
  SurpriseState,
  DEFAULT_SURPRISE_STATE
)
