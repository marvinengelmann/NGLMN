import "@/affect/emotion/init.ts"
import { getRegisteredEmotions } from "@/affect/emotion/registry.ts"
import type { EmotionalState, SecondaryEmotionState } from "@/affect/emotion/types.ts"
import { computeEmotionalIntensity } from "@/affect/emotion/update.ts"
import { applyClampedDeltas } from "@/infra/lib/math.ts"
import { buildEmotionContext, type SharedEmotionInput } from "../../emotions.ts"
import type { SecondaryResult } from "./types.ts"

const SECONDARY_ENERGY_FLOOR = 0.05
const SATURATION_ONSET = 0.7
const SATURATION_SCALE = 2
const SATURATION_MIN = 0.3

function computeSaturationDamping(emotion: EmotionalState): number {
  const intensity = computeEmotionalIntensity(emotion)
  if (intensity <= SATURATION_ONSET) return 1
  return Math.max(SATURATION_MIN, 1 - (intensity - SATURATION_ONSET) * SATURATION_SCALE)
}

export function runSecondaryEmotions(shared: SharedEmotionInput): SecondaryResult {
  const previousStates = shared.previousSecondaryEmotionStates
  const computedStates = new Map<string, SecondaryEmotionState>()
  computedStates.set("shame", shared.shameState)

  let emotion = shared.emotion
  const preSecondaryEnergy = emotion.energy

  getRegisteredEmotions()
    .filter((entry) => entry.name !== "shame")
    .forEach((entry) => {
      const previous = previousStates.get(entry.name) ?? entry.defaultState
      const context = buildEmotionContext(entry.name, { ...shared, emotion }, previous, previousStates, computedStates)
      const state = entry.compute(context)
      computedStates.set(entry.name, state)
      if (entry.computeEffect && state.isActive) {
        const damping = computeSaturationDamping(emotion)
        const rawEffects = entry.computeEffect(state)
        const dampenedEffects =
          damping < 1
            ? (Object.fromEntries(
                Object.entries(rawEffects).map(([k, v]) => [k, typeof v === "number" ? v * damping : v])
              ) as Partial<Record<keyof EmotionalState, number>>)
            : rawEffects
        emotion = applyClampedDeltas(emotion, dampenedEffects)
      }
    })

  if (emotion.energy < SECONDARY_ENERGY_FLOOR && preSecondaryEnergy >= SECONDARY_ENERGY_FLOOR) {
    emotion = { ...emotion, energy: SECONDARY_ENERGY_FLOOR }
  }

  const statesToSave = new Map(computedStates)
  statesToSave.delete("shame")

  const hasActiveSecondary = [...computedStates.values()].some((s) => s.isActive)

  const states = Object.fromEntries([...computedStates.entries()].filter(([name]) => name !== "shame"))

  return { emotion, secondaryEmotions: states, secondaryEmotionStates: statesToSave, hasActiveSecondary }
}
