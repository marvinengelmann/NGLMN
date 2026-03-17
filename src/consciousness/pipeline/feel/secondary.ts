import "@/affect/emotion/init.ts"
import { getRegisteredEmotions } from "@/affect/emotion/registry.ts"
import type { EmotionalState, SecondaryEmotionState } from "@/affect/emotion/types.ts"
import { computeEmotionalIntensity, enforceEmotionFloors } from "@/affect/emotion/update.ts"
import { applyClampedDeltas } from "@/infra/lib/math.ts"
import { buildEmotionContext, type SharedEmotionInput } from "../../emotions.ts"
import type { SecondaryResult } from "./types.ts"

const SATURATION_ONSET = 0.7
const SATURATION_SCALE = 2
const SATURATION_MIN = 0.3

function computeSaturationDamping(emotion: EmotionalState): number {
  const intensity = computeEmotionalIntensity(emotion)
  if (intensity <= SATURATION_ONSET) return 1
  return Math.max(SATURATION_MIN, 1 - (intensity - SATURATION_ONSET) * SATURATION_SCALE)
}

const SECONDARY_EFFECT_CAP = 0.15

function capSecondaryEffects(pre: EmotionalState, post: EmotionalState, cap: number): EmotionalState {
  const result = { ...post }
  for (const key of Object.keys(pre) as (keyof EmotionalState)[]) {
    const delta = result[key] - pre[key]
    if (Math.abs(delta) > cap) {
      result[key] = pre[key] + Math.sign(delta) * cap
    }
  }
  return result
}

export function runSecondaryEmotions(shared: SharedEmotionInput): SecondaryResult {
  const previousStates = shared.previousSecondaryEmotionStates
  const computedStates = new Map<string, SecondaryEmotionState>()
  computedStates.set("shame", shared.shameState)

  let emotion = shared.emotion
  const preSecondaryEmotion = { ...emotion }

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
        const energyDrain = rawEffects.energy
        const hasEnergyDrain = typeof energyDrain === "number" && energyDrain < 0
        const energyScale = hasEnergyDrain ? emotion.energy : 1
        const scaledEffects = Object.fromEntries(
          Object.entries(rawEffects).map(([k, v]) => {
            if (typeof v !== "number") return [k, v]
            let scaled = damping < 1 ? v * damping : v
            if (k === "energy" && scaled < 0) scaled *= energyScale
            return [k, scaled]
          })
        ) as Partial<Record<keyof EmotionalState, number>>
        emotion = applyClampedDeltas(emotion, scaledEffects)
      }
    })

  emotion = capSecondaryEffects(preSecondaryEmotion, emotion, SECONDARY_EFFECT_CAP)
  emotion = enforceEmotionFloors(emotion)

  const statesToSave = new Map(computedStates)
  statesToSave.delete("shame")

  const hasActiveSecondary = [...computedStates.values()].some((s) => s.isActive)

  const states = Object.fromEntries([...computedStates.entries()].filter(([name]) => name !== "shame"))

  return { emotion, secondaryEmotions: states, secondaryEmotionStates: statesToSave, hasActiveSecondary }
}
