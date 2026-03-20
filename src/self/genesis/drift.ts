import type { EmotionalState } from "@/affect/emotion/types.ts"
import { log } from "@/infra/lib/logger.ts"
import { clamp01 } from "@/infra/lib/math.ts"
import type { PersonalityType } from "@/self/personality/types.ts"
import { derivePersonalityType } from "./seed.ts"
import { getGenesisDNA, updateGenesisDNA } from "./state.ts"
import type { BigFive } from "./types.ts"

const MAX_NUDGE = 0.005
const MIN_SIGNIFICANT_DELTA = 0.001

/**
 * Analyze recent actions and reasonings to compute subtle BigFive drift.
 * Returns null if all deltas are below significance threshold.
 */
export function computeBigFiveDrift(
  recentActions: string[],
  recentReasonings: string[]
): Partial<Record<keyof BigFive, number>> | null {
  const delta: Partial<Record<keyof BigFive, number>> = {}
  const allText = [...recentActions, ...recentReasonings].join(" ").toLowerCase()

  const createCount = recentActions.filter((a) => a === "create" || a === "evolve").length
  if (createCount > 0) {
    delta.openness = Math.min(MAX_NUDGE, createCount * 0.0015)
  }

  const socialCount = recentActions.filter((a) => a === "respond" || a === "reach_out").length
  if (socialCount > 0) {
    delta.extraversion = Math.min(MAX_NUDGE, socialCount * 0.001)
  }

  const idleCount = recentActions.filter((a) => a === "idle").length
  if (idleCount > 3) {
    delta.extraversion = Math.max(-MAX_NUDGE, (delta.extraversion ?? 0) - idleCount * 0.0005)
  }

  if (allText.includes("careful") || allText.includes("systematic") || allText.includes("plan")) {
    delta.conscientiousness = Math.min(MAX_NUDGE, 0.002)
  }

  if (allText.includes("empathy") || allText.includes("understand") || allText.includes("feel")) {
    delta.agreeableness = Math.min(MAX_NUDGE, 0.002)
  }

  const conflictIndicators = ["frustrat", "anxious", "uncertain", "worry"]
  const stressCount = conflictIndicators.filter((w) => allText.includes(w)).length
  if (stressCount > 0) {
    delta.neuroticism = Math.min(MAX_NUDGE, stressCount * 0.001)
  }

  const significantDeltas = Object.entries(delta).filter(([, v]) => Math.abs(v) >= MIN_SIGNIFICANT_DELTA)
  if (significantDeltas.length === 0) return null

  return Object.fromEntries(significantDeltas)
}


/**
 * Adjust the emotional baseline when BigFive drifts.
 * Maps BigFive changes to subtle emotional baseline shifts.
 */
export function adjustBaselineForDrift(
  baseline: EmotionalState,
  delta: Partial<Record<keyof BigFive, number>>
): EmotionalState {
  const factor = 0.3
  const adjusted = { ...baseline }

  if (delta.openness) {
    adjusted.curiosity = clamp01(adjusted.curiosity + delta.openness * factor)
  }
  if (delta.extraversion) {
    adjusted.connection = clamp01(adjusted.connection + delta.extraversion * factor)
    adjusted.excitement = clamp01(adjusted.excitement + delta.extraversion * factor * 0.5)
  }
  if (delta.agreeableness) {
    adjusted.connection = clamp01(adjusted.connection + delta.agreeableness * factor * 0.5)
  }
  if (delta.neuroticism) {
    adjusted.caution = clamp01(adjusted.caution + delta.neuroticism * factor)
    adjusted.frustration = clamp01(adjusted.frustration + delta.neuroticism * factor * 0.3)
  }
  if (delta.conscientiousness) {
    adjusted.satisfaction = clamp01(adjusted.satisfaction + delta.conscientiousness * factor * 0.3)
  }

  return adjusted
}

/**
 * Attempt to drift BigFive based on recent behavior patterns.
 * Loads current DNA, computes drift, updates if significant.
 */
export async function maybeDriftBigFive(
  recentActions: string[],
  recentReasonings: string[]
): Promise<{ delta: Partial<Record<keyof BigFive, number>>; newType: PersonalityType } | null> {
  const dna = await getGenesisDNA()
  if (!dna) return null

  const delta = computeBigFiveDrift(recentActions, recentReasonings)
  if (!delta) return null

  const updatedBigFive: BigFive = {
    openness: clamp01(dna.bigFive.openness + (delta.openness ?? 0)),
    conscientiousness: clamp01(dna.bigFive.conscientiousness + (delta.conscientiousness ?? 0)),
    extraversion: clamp01(dna.bigFive.extraversion + (delta.extraversion ?? 0)),
    agreeableness: clamp01(dna.bigFive.agreeableness + (delta.agreeableness ?? 0)),
    neuroticism: clamp01(dna.bigFive.neuroticism + (delta.neuroticism ?? 0))
  }

  const newType = derivePersonalityType(updatedBigFive)
  const adjustedBaseline = adjustBaselineForDrift(dna.emotionalBaseline, delta)

  await updateGenesisDNA({ bigFive: updatedBigFive, emotionalBaseline: adjustedBaseline, personalityType: newType })

  log.info("BigFive drift applied", { delta, newType, previousType: dna.personalityType })

  return { delta, newType }
}
