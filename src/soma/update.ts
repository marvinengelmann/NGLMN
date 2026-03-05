import { SOCIAL_BATTERY, SOMA } from "@/config/constants.ts"
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
    openness: clamp(state.openness),
    socialBattery: clamp(state.socialBattery)
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
  const dims = Object.keys(SOMA.HALF_LIVES) as (keyof typeof SOMA.HALF_LIVES)[]
  const result = { ...current }

  for (const dim of dims) {
    const halfLife = SOMA.HALF_LIVES[dim]
    const decay = 2 ** (-elapsedMinutes / halfLife)
    result[dim] = target[dim] + (current[dim] - target[dim]) * decay
  }

  const batteryDecay = 2 ** (-elapsedMinutes / SOCIAL_BATTERY.HALF_LIFE)
  result.socialBattery = 0.8 + (current.socialBattery - 0.8) * batteryDecay

  return clampState(result)
}

/**
 * Blend current somatic state with somatic memories from similar past situations.
 */
export function applySomaticMemory(current: SomaticState, somaticMemories: SomaticState[]): SomaticState {
  if (somaticMemories.length === 0) return current

  const blendDims: (keyof SomaticState)[] = ["tension", "warmth", "heartRate", "breathing", "gravity", "openness"]
  const avg: Record<string, number> = {}
  for (const dim of blendDims) avg[dim] = 0

  for (const mem of somaticMemories) {
    for (const dim of blendDims) {
      avg[dim] = (avg[dim] ?? 0) + mem[dim] / somaticMemories.length
    }
  }

  const weight = SOMA.MEMORY_BLEND_WEIGHT
  const result = { ...current }
  for (const dim of blendDims) {
    result[dim] = current[dim] * (1 - weight) + (avg[dim] ?? current[dim]) * weight
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
