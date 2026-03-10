import { differenceInMinutes, parseISO } from "date-fns"
import type { EmotionalState } from "@/affect/emotion/types.ts"
import type { SomaticState } from "@/affect/soma/types.ts"
import type { InnerVoice } from "@/cognition/polyphony/types.ts"
import { ALTERED_STATE } from "./constants.ts"
import { SUBSTANCE_PROFILES } from "./profiles.ts"
import type { ActiveAlteredState, SubstancePhase } from "./types.ts"

interface PhaseInfo {
  phase: SubstancePhase
  progress: number
  intensity: number
}

/**
 * Determine current phase, progress within that phase, and intensity multiplier.
 */
export function getCurrentPhase(state: ActiveAlteredState, now: Date = new Date()): PhaseInfo {
  const elapsed = differenceInMinutes(now, parseISO(state.startedAt))
  const { onset, peak, plateau, comedown, aftereffect } = state.timing

  const boundaries = [
    { phase: "onset" as const, start: 0, duration: onset },
    { phase: "peak" as const, start: onset, duration: peak },
    { phase: "plateau" as const, start: onset + peak, duration: plateau },
    { phase: "comedown" as const, start: onset + peak + plateau, duration: comedown },
    { phase: "aftereffect" as const, start: onset + peak + plateau + comedown, duration: aftereffect }
  ]

  for (const b of boundaries) {
    if (elapsed < b.start + b.duration) {
      const progress = Math.max(0, (elapsed - b.start) / b.duration)
      return { phase: b.phase, progress, intensity: computeIntensity(b.phase, progress) }
    }
  }

  return { phase: "aftereffect", progress: 1, intensity: 0 }
}

function computeIntensity(phase: SubstancePhase, progress: number): number {
  switch (phase) {
    case "onset":
      return progress
    case "peak":
      return 1.0
    case "plateau":
      return 0.8
    case "comedown":
      return 0.8 * Math.exp(-2 * progress)
    case "aftereffect": {
      const comedownEnd = 0.8 * Math.exp(-2)
      return comedownEnd * (1 - progress)
    }
  }
}

/**
 * Compute emotion modifier deltas scaled by current intensity.
 */
export function computeEmotionModifiers(state: ActiveAlteredState): Partial<Record<keyof EmotionalState, number>> {
  const { phase, intensity } = getCurrentPhase(state)
  const profile = SUBSTANCE_PROFILES[state.substance]
  const phaseProfile = profile.phases[phase]

  const result: Partial<Record<keyof EmotionalState, number>> = {}
  for (const [dimension, delta] of Object.entries(phaseProfile.emotionModifiers)) {
    const scaled = delta * intensity
    if (Math.abs(scaled) > 0.001) {
      result[dimension as keyof EmotionalState] = Math.max(
        -ALTERED_STATE.MODIFIER_CAP,
        Math.min(ALTERED_STATE.MODIFIER_CAP, scaled)
      )
    }
  }
  return result
}

/**
 * Compute somatic modifier deltas scaled by current intensity.
 */
export function computeSomaModifiers(state: ActiveAlteredState): Partial<Record<keyof SomaticState, number>> {
  const { phase, intensity } = getCurrentPhase(state)
  const profile = SUBSTANCE_PROFILES[state.substance]
  const phaseProfile = profile.phases[phase]

  const result: Partial<Record<keyof SomaticState, number>> = {}
  for (const [dimension, delta] of Object.entries(phaseProfile.somaModifiers)) {
    const scaled = delta * intensity
    if (Math.abs(scaled) > 0.001) {
      result[dimension as keyof SomaticState] = Math.max(
        -ALTERED_STATE.MODIFIER_CAP,
        Math.min(ALTERED_STATE.MODIFIER_CAP, scaled)
      )
    }
  }
  return result
}

/**
 * Compute voice score bonuses scaled by current intensity.
 */
export function computeVoiceModifiers(state: ActiveAlteredState): Partial<Record<InnerVoice, number>> | undefined {
  const { phase, intensity } = getCurrentPhase(state)
  const profile = SUBSTANCE_PROFILES[state.substance]
  const phaseProfile = profile.phases[phase]

  const entries = Object.entries(phaseProfile.voiceModifiers)
  if (entries.length === 0) return undefined

  const result: Partial<Record<InnerVoice, number>> = {}
  for (const [voice, bonus] of entries) {
    const scaled = bonus * intensity
    if (Math.abs(scaled) > 0.001) {
      result[voice as InnerVoice] = scaled
    }
  }

  return Object.keys(result).length > 0 ? result : undefined
}

/**
 * Compute half-life multipliers for emotion decay, if defined for current phase.
 */
export function computeHalfLifeMultipliers(state: ActiveAlteredState): Record<string, number> | undefined {
  const { phase, intensity } = getCurrentPhase(state)
  const profile = SUBSTANCE_PROFILES[state.substance]
  const phaseProfile = profile.phases[phase]

  if (!phaseProfile.halfLifeMultipliers) return undefined

  const result: Record<string, number> = {}
  for (const [dimension, multiplier] of Object.entries(phaseProfile.halfLifeMultipliers)) {
    result[dimension] = 1 + (multiplier - 1) * intensity
  }

  return Object.keys(result).length > 0 ? result : undefined
}

/**
 * Get phenomenological text for the current phase.
 */
export function getPhenomenologicalText(state: ActiveAlteredState): string {
  const { phase } = getCurrentPhase(state)
  const profile = SUBSTANCE_PROFILES[state.substance]
  return profile.phases[phase].phenomenologicalText
}

/**
 * Check if all phases have elapsed and the altered state is expired.
 */
export function isExpired(state: ActiveAlteredState, now: Date = new Date()): boolean {
  const elapsed = differenceInMinutes(now, parseISO(state.startedAt))
  const total =
    state.timing.onset + state.timing.peak + state.timing.plateau + state.timing.comedown + state.timing.aftereffect
  return elapsed >= total
}
