import { getAllSecondaryEmotionStates } from "@/affect/emotion/batch.ts"
import "@/affect/emotion/init.ts"
import { getRegisteredEmotions } from "@/affect/emotion/registry.ts"
import type { EmotionalState, SecondaryEmotionState } from "@/affect/emotion/types.ts"
import { buildEmotionContext, type SharedEmotionInput } from "../../emotions.ts"
import type { SecondaryResult } from "./types.ts"

function applyEmotionEffect(
  emotion: EmotionalState,
  effect: Partial<Record<keyof EmotionalState, number>>
): EmotionalState {
  return Object.entries(effect).reduce((acc, [dimension, delta]) => {
    const key = dimension as keyof EmotionalState
    if (key in acc) {
      return { ...acc, [key]: Math.max(0, Math.min(1, acc[key] + delta)) }
    }
    return acc
  }, emotion)
}

export async function runSecondaryEmotions(shared: SharedEmotionInput): Promise<SecondaryResult> {
  const previousStates = await getAllSecondaryEmotionStates()
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
        emotion = applyEmotionEffect(emotion, entry.computeEffect(state))
      }
    })

  const statesToSave = new Map(computedStates)
  statesToSave.delete("shame")

  const hasActiveSecondary = [...computedStates.values()].some((s) => s.isActive)

  const states = Object.fromEntries(
    [...computedStates.entries()].filter(([name]) => name !== "shame")
  )

  return { emotion, secondaryEmotions: states, secondaryEmotionStates: statesToSave, hasActiveSecondary }
}
