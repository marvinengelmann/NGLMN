import "@/affect/emotion/init.ts"
import { getRegisteredEmotions } from "@/affect/emotion/registry.ts"
import type { SecondaryEmotionState } from "@/affect/emotion/types.ts"
import { applyClampedDeltas } from "@/infra/lib/math.ts"
import { buildEmotionContext, type SharedEmotionInput } from "../../emotions.ts"
import type { SecondaryResult } from "./types.ts"

export function runSecondaryEmotions(shared: SharedEmotionInput): SecondaryResult {
  const previousStates = shared.previousSecondaryEmotionStates
  const computedStates = new Map<string, SecondaryEmotionState>()
  computedStates.set("shame", shared.shameState)

  let emotion = shared.emotion

  getRegisteredEmotions()
    .filter((entry) => entry.name !== "shame")
    .forEach((entry) => {
      const previous = previousStates.get(entry.name) ?? entry.defaultState
      const context = buildEmotionContext(entry.name, { ...shared, emotion }, previous, previousStates, computedStates)
      const state = entry.compute(context)
      computedStates.set(entry.name, state)
      if (entry.computeEffect && state.isActive) {
        emotion = applyClampedDeltas(emotion, entry.computeEffect(state))
      }
    })

  const statesToSave = new Map(computedStates)
  statesToSave.delete("shame")

  const hasActiveSecondary = [...computedStates.values()].some((s) => s.isActive)

  const states = Object.fromEntries([...computedStates.entries()].filter(([name]) => name !== "shame"))

  return { emotion, secondaryEmotions: states, secondaryEmotionStates: statesToSave, hasActiveSecondary }
}
