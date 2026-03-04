import { SOMA } from "@/config/constants.ts"
import type { EmotionalState } from "@/emotion/types.ts"
import type { SomaticState } from "./types.ts"

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function clampState(state: SomaticState): SomaticState {
  return {
    tension: clamp(state.tension),
    warmth: clamp(state.warmth),
    heartRate: clamp(state.heartRate),
    breathing: clamp(state.breathing),
    gravity: clamp(state.gravity),
    openness: clamp(state.openness)
  }
}

/**
 * Compute the target somatic state from the current emotional state.
 */
export function computeSomaticTarget(emotion: EmotionalState): SomaticState {
  return clampState({
    tension: 0.3 + 0.4 * emotion.frustration + 0.2 * emotion.caution - 0.2 * emotion.satisfaction,
    warmth: 0.3 + 0.4 * emotion.connection + 0.2 * emotion.satisfaction - 0.2 * emotion.caution,
    heartRate: 0.3 + 0.3 * emotion.excitement + 0.2 * emotion.frustration + 0.1 * emotion.energy,
    breathing: 0.6 - 0.3 * emotion.caution - 0.2 * emotion.frustration + 0.2 * emotion.satisfaction,
    gravity: 0.5 - 0.3 * emotion.energy + 0.2 * emotion.boredom - 0.1 * emotion.excitement,
    openness:
      0.3 + 0.3 * emotion.connection + 0.2 * emotion.curiosity + 0.1 * emotion.confidence - 0.3 * emotion.caution
  })
}

/**
 * Apply exponential decay hysteresis — somatic state drifts toward target with dimension-specific half-lives.
 */
export function applySomaticHysteresis(
  current: SomaticState,
  target: SomaticState,
  elapsedMinutes: number
): SomaticState {
  const dims = Object.keys(SOMA.HALF_LIVES) as (keyof SomaticState)[]
  const result = { ...current }

  for (const dim of dims) {
    const halfLife = SOMA.HALF_LIVES[dim]
    const decay = 2 ** (-elapsedMinutes / halfLife)
    result[dim] = target[dim] + (current[dim] - target[dim]) * decay
  }

  return clampState(result)
}

/**
 * Blend current somatic state with somatic memories from similar past situations.
 */
export function applySomaticMemory(current: SomaticState, somaticMemories: SomaticState[]): SomaticState {
  if (somaticMemories.length === 0) return current

  const avg: SomaticState = { tension: 0, warmth: 0, heartRate: 0, breathing: 0, gravity: 0, openness: 0 }
  const dims = Object.keys(avg) as (keyof SomaticState)[]

  for (const mem of somaticMemories) {
    for (const dim of dims) {
      avg[dim] += mem[dim] / somaticMemories.length
    }
  }

  const weight = SOMA.MEMORY_BLEND_WEIGHT
  const result = { ...current }
  for (const dim of dims) {
    result[dim] = current[dim] * (1 - weight) + avg[dim] * weight
  }

  return clampState(result)
}

/**
 * Full somatic update pipeline: target → hysteresis → memory → clamp.
 */
export function computeSomaticUpdate(
  current: SomaticState,
  emotion: EmotionalState,
  elapsedMinutes: number,
  memories?: SomaticState[]
): SomaticState {
  const target = computeSomaticTarget(emotion)
  let result = applySomaticHysteresis(current, target, elapsedMinutes)
  if (memories && memories.length > 0) {
    result = applySomaticMemory(result, memories)
  }
  return result
}
