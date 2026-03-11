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

  const match = boundaries.find((b) => elapsed < b.start + b.duration)
  if (match) {
    const progress = Math.max(0, (elapsed - match.start) / match.duration)
    return { phase: match.phase, progress, intensity: computeIntensity(match.phase, progress) }
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

  return Object.fromEntries(
    Object.entries(phaseProfile.emotionModifiers)
      .map(([dimension, delta]) => [dimension, delta * intensity])
      .filter(([, scaled]) => Math.abs(scaled as number) > 0.001)
      .map(([dimension, scaled]) => [
        dimension,
        Math.max(-ALTERED_STATE.MODIFIER_CAP, Math.min(ALTERED_STATE.MODIFIER_CAP, scaled as number))
      ])
  ) as Partial<Record<keyof EmotionalState, number>>
}

/**
 * Compute somatic modifier deltas scaled by current intensity.
 */
export function computeSomaModifiers(state: ActiveAlteredState): Partial<Record<keyof SomaticState, number>> {
  const { phase, intensity } = getCurrentPhase(state)
  const profile = SUBSTANCE_PROFILES[state.substance]
  const phaseProfile = profile.phases[phase]

  return Object.fromEntries(
    Object.entries(phaseProfile.somaModifiers)
      .map(([dimension, delta]) => [dimension, delta * intensity])
      .filter(([, scaled]) => Math.abs(scaled as number) > 0.001)
      .map(([dimension, scaled]) => [
        dimension,
        Math.max(-ALTERED_STATE.MODIFIER_CAP, Math.min(ALTERED_STATE.MODIFIER_CAP, scaled as number))
      ])
  ) as Partial<Record<keyof SomaticState, number>>
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

  const result = Object.fromEntries(
    entries
      .map(([voice, bonus]) => [voice, bonus * intensity])
      .filter(([, scaled]) => Math.abs(scaled as number) > 0.001)
  ) as Partial<Record<InnerVoice, number>>

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
