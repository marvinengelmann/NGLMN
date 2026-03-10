import { createStateManager } from "@/infra/lib/state.ts"
import { DEFAULT_HABIT_STATE, HabitState } from "./types.ts"

export const { get: getHabitState, save: saveHabitState } = createStateManager(
  "working:habit:state",
  HabitState,
  DEFAULT_HABIT_STATE
)
