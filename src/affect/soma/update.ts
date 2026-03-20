import type { EmotionalState } from "@/affect/emotion/types.ts"
import { clamp01, halfLifeDecay } from "@/infra/lib/math.ts"
import { IMMUNE, SOCIAL_BATTERY, SOMA } from "./constants.ts"
import type { SomaticState } from "./types.ts"

const { CIRCADIAN } = SOMA

/**
 * Compute circadian fatigue [0, 1] based on hour of day.
 * Models a human-like energy cycle: peak alertness mid-morning, post-lunch dip, evening decline, night low.
 */
export function circadianFatigue(hourOfDay: number): number {
  const primary = Math.cos((2 * Math.PI * (hourOfDay - CIRCADIAN.PEAK_HOUR)) / 24)
  const postLunchDip = Math.exp(-0.5 * ((hourOfDay - CIRCADIAN.POST_LUNCH_CENTER) / CIRCADIAN.POST_LUNCH_WIDTH) ** 2)
  const alertness = 0.55 + 0.4 * primary - CIRCADIAN.POST_LUNCH_DEPTH * postLunchDip
  return clamp01(1 - alertness)
}

function clampState(state: SomaticState): SomaticState {
  return {
    tension: clamp01(state.tension),
    warmth: clamp01(state.warmth),
    heartRate: clamp01(state.heartRate),
    breathing: clamp01(state.breathing),
    gravity: clamp01(state.gravity),
    openness: clamp01(state.openness),
    socialBattery: clamp01(state.socialBattery),
    immuneResilience: clamp01(state.immuneResilience)
  }
}

/**
 * Compute the target somatic state from the current emotional state.
 * Social battery and immune resilience are not driven by emotions — they have their own update cycles.
 */
export function computeSomaticTarget(emotion: EmotionalState, hourOfDay: number): SomaticState {
  const fatigue = circadianFatigue(hourOfDay)
  return clampState({
    tension: 0.3 + 0.4 * emotion.frustration + 0.2 * emotion.caution - 0.2 * emotion.satisfaction,
    warmth: 0.3 + 0.4 * emotion.connection + 0.2 * emotion.satisfaction - 0.2 * emotion.caution,
    heartRate:
      0.3 +
      0.3 * emotion.excitement +
      0.2 * emotion.frustration +
      0.1 * emotion.energy -
      CIRCADIAN.HEART_RATE_WEIGHT * fatigue,
    breathing: 0.6 - 0.3 * emotion.caution - 0.2 * emotion.frustration + 0.2 * emotion.satisfaction,
    gravity:
      0.5 -
      0.3 * emotion.energy +
      0.2 * emotion.boredom -
      0.1 * emotion.excitement +
      CIRCADIAN.GRAVITY_WEIGHT * fatigue,
    openness:
      0.3 + 0.3 * emotion.connection + 0.2 * emotion.curiosity + 0.1 * emotion.confidence - 0.3 * emotion.caution,
    socialBattery: 0.65,
    immuneResilience: IMMUNE.BASELINE
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
  const drifted = Object.fromEntries(
    (Object.keys(SOMA.HALF_LIVES) as (keyof typeof SOMA.HALF_LIVES)[]).map((dimension) => {
      const halfLife = SOMA.HALF_LIVES[dimension]
      const decay = halfLifeDecay(elapsedMinutes, halfLife)
      return [dimension, target[dimension] + (current[dimension] - target[dimension]) * decay]
    })
  )
  const result = { ...current, ...drifted }

  const batteryDecay = halfLifeDecay(elapsedMinutes, SOCIAL_BATTERY.HALF_LIFE)
  result.socialBattery = 0.65 + (current.socialBattery - 0.65) * batteryDecay

  return clampState(result)
}

/**
 * Blend current somatic state with somatic memories from similar past situations.
 */
export function applySomaticMemory(current: SomaticState, somaticMemories: SomaticState[]): SomaticState {
  if (somaticMemories.length === 0) return current

  const blendDimensions: (keyof SomaticState)[] = ["tension", "warmth", "heartRate", "breathing", "gravity", "openness"]
  const avg = Object.fromEntries(
    blendDimensions.map((dimension) => [
      dimension,
      somaticMemories.reduce((sum, memory) => sum + memory[dimension], 0) / somaticMemories.length
    ])
  )

  const weight = SOMA.MEMORY_BLEND_WEIGHT
  const blended = Object.fromEntries(
    blendDimensions.map((dimension) => [
      dimension,
      current[dimension] * (1 - weight) + (avg[dimension] ?? current[dimension]) * weight
    ])
  )
  const result = { ...current, ...blended }

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
 * Compute immune resilience target from stress and recovery signals.
 * Chronic cortisol elevation suppresses immunity; social connection and energy boost it.
 */
export function computeImmuneTarget(emotion: EmotionalState, cortisolLevel: number, allostaticLoad: number): number {
  const cortisolSuppression =
    Math.max(0, cortisolLevel - IMMUNE.CORTISOL_THRESHOLD) * IMMUNE.CORTISOL_SUPPRESSION_WEIGHT
  const allostaticDrain = Math.max(0, allostaticLoad - IMMUNE.ALLOSTATIC_THRESHOLD) * IMMUNE.ALLOSTATIC_DRAIN_WEIGHT
  const stressDrain =
    (Math.max(0, emotion.frustration - 0.5) + Math.max(0, emotion.caution - 0.5)) * IMMUNE.STRESS_EMOTION_WEIGHT
  const connectionBoost = Math.max(0, emotion.connection - 0.5) * IMMUNE.CONNECTION_BOOST_WEIGHT
  const energyBoost = Math.max(0, emotion.energy - 0.5) * IMMUNE.ENERGY_CORRELATION_WEIGHT

  return clamp01(IMMUNE.BASELINE - cortisolSuppression - allostaticDrain - stressDrain + connectionBoost + energyBoost)
}

interface SomaticUpdateOptions {
  current: SomaticState
  emotion: EmotionalState
  elapsedMinutes: number
  hourOfDay: number
  memories?: SomaticState[]
  isolationEnergyDrain?: number
  cortisolLevel?: number
  allostaticLoad?: number
}

/**
 * Full somatic update pipeline: target → hysteresis → memory → immune → clamp.
 */
export function computeSomaticUpdate({
  current,
  emotion,
  elapsedMinutes,
  hourOfDay,
  memories,
  isolationEnergyDrain,
  cortisolLevel,
  allostaticLoad
}: SomaticUpdateOptions): SomaticState {
  const target = computeSomaticTarget(emotion, hourOfDay)
  let result = applySomaticHysteresis(current, target, elapsedMinutes)
  if (memories && memories.length > 0) {
    result = applySomaticMemory(result, memories)
  }
  if (isolationEnergyDrain && isolationEnergyDrain > 0) {
    result = clampState({
      ...result,
      gravity: clamp01(result.gravity + isolationEnergyDrain * 0.5),
      openness: clamp01(result.openness - isolationEnergyDrain * 0.3)
    })
  }

  const immuneTarget = computeImmuneTarget(emotion, cortisolLevel ?? 0.2, allostaticLoad ?? 0)
  const immuneDecay = halfLifeDecay(elapsedMinutes, IMMUNE.HALF_LIFE)
  result = {
    ...result,
    immuneResilience: clamp01(immuneTarget + (current.immuneResilience - immuneTarget) * immuneDecay)
  }

  return result
}
