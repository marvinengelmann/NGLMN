import { SOCIAL_BATTERY, SOMA } from "@/config/constants.ts"
import type { EmotionalState } from "@/emotion/types.ts"
import { clamp01, halfLifeDecay } from "@/lib/math.ts"
import type { SomaticState } from "./types.ts"

function clampState(state: SomaticState): SomaticState {
  return {
    tension: clamp01(state.tension),
    warmth: clamp01(state.warmth),
    heartRate: clamp01(state.heartRate),
    breathing: clamp01(state.breathing),
    gravity: clamp01(state.gravity),
    openness: clamp01(state.openness),
    socialBattery: clamp01(state.socialBattery)
  }
}

/**
 * Compute the target somatic state from the current emotional state.
 * Social battery is not driven by emotions — it has its own drain/recharge cycle.
 */
export function computeSomaticTarget(emotion: EmotionalState): SomaticState {
  return clampState({
    tension: 0.3 + 0.4 * emotion.frustration + 0.2 * emotion.caution - 0.2 * emotion.satisfaction,
    warmth: 0.3 + 0.4 * emotion.connection + 0.2 * emotion.satisfaction - 0.2 * emotion.caution,
    heartRate: 0.3 + 0.3 * emotion.excitement + 0.2 * emotion.frustration + 0.1 * emotion.energy,
    breathing: 0.6 - 0.3 * emotion.caution - 0.2 * emotion.frustration + 0.2 * emotion.satisfaction,
    gravity: 0.5 - 0.3 * emotion.energy + 0.2 * emotion.boredom - 0.1 * emotion.excitement,
    openness:
      0.3 + 0.3 * emotion.connection + 0.2 * emotion.curiosity + 0.1 * emotion.confidence - 0.3 * emotion.caution,
    socialBattery: 0.8
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
  const dimensions = Object.keys(SOMA.HALF_LIVES) as (keyof typeof SOMA.HALF_LIVES)[]
  const result = { ...current }

  for (const dimension of dimensions) {
    const halfLife = SOMA.HALF_LIVES[dimension]
    const decay = halfLifeDecay(elapsedMinutes, halfLife)
    result[dimension] = target[dimension] + (current[dimension] - target[dimension]) * decay
  }

  const batteryDecay = halfLifeDecay(elapsedMinutes, SOCIAL_BATTERY.HALF_LIFE)
  result.socialBattery = 0.8 + (current.socialBattery - 0.8) * batteryDecay

  return clampState(result)
}

/**
 * Blend current somatic state with somatic memories from similar past situations.
 */
export function applySomaticMemory(current: SomaticState, somaticMemories: SomaticState[]): SomaticState {
  if (somaticMemories.length === 0) return current

  const blendDimensions: (keyof SomaticState)[] = ["tension", "warmth", "heartRate", "breathing", "gravity", "openness"]
  const avg: Record<string, number> = {}
  for (const dimension of blendDimensions) avg[dimension] = 0

  for (const memory of somaticMemories) {
    for (const dimension of blendDimensions) {
      avg[dimension] = (avg[dimension] ?? 0) + memory[dimension] / somaticMemories.length
    }
  }

  const weight = SOMA.MEMORY_BLEND_WEIGHT
  const result = { ...current }
  for (const dimension of blendDimensions) {
    result[dimension] = current[dimension] * (1 - weight) + (avg[dimension] ?? current[dimension]) * weight
  }

  return clampState(result)
}

/**
 * Drain social battery when messages are sent or received.
 */
export function drainSocialBattery(current: SomaticState, sentCount: number, receivedCount: number): SomaticState {
  const drain = sentCount * SOCIAL_BATTERY.SENT_MESSAGE_DRAIN + receivedCount * SOCIAL_BATTERY.RECEIVED_MESSAGE_DRAIN
  return clampState({
    ...current,
    socialBattery: current.socialBattery - drain
  })
}

/**
 * Recharge social battery during idle ticks or dream cycles.
 */
export function rechargeSocialBattery(current: SomaticState, isDreaming: boolean): SomaticState {
  const recharge = isDreaming ? SOCIAL_BATTERY.DREAM_RECHARGE : SOCIAL_BATTERY.IDLE_RECHARGE
  return clampState({
    ...current,
    socialBattery: current.socialBattery + recharge
  })
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
