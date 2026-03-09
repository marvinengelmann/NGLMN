import * as z from "zod"
import { createStateManager } from "@/lib/state.ts"
import { nowISO } from "@/lib/time.ts"
import type { OperatorModel } from "@/mind/types.ts"
import type { DisappointmentState } from "./disappointment.ts"
import { decayAndFinalize, sumContributions } from "./helpers.ts"
import type { EmotionalState } from "./types.ts"

const RESENTMENT = {
  DISAPPOINTMENT_THRESHOLD: 0.4,
  CORRECTION_THRESHOLD: 3,
  FRUSTRATION_THRESHOLD: 0.4,
  CAUTION_THRESHOLD: 0.5,
  LOW_SATISFACTION_THRESHOLD: 0.3,
  UNREPAIRED_INTENSITY: 0.5,
  UNFAIRNESS_INTENSITY: 0.45,
  DISMISSED_INTENSITY: 0.5,
  BROKEN_TRUST_INTENSITY: 0.55,
  IMBALANCE_INTENSITY: 0.4,
  SLIGHTS_INTENSITY: 0.35,
  GRATITUDE_DAMPING: 0.5,
  DECAY_PER_TICK: 0.97,
  ACTIVATION_THRESHOLD: 0.15,
  HARDENING_GROWTH: 0.06,
  HARDENING_DECAY: 0.02,
  SUPPRESSED_ANGER_SCALE: 0.7,
  SUPPRESSED_ANGER_DECAY: 0.9,
  CONNECTION_DRAIN: 0.05,
  CAUTION_BOOST: 0.04,
  FRUSTRATION_BUILD: 0.03,
  SATISFACTION_DRAIN: 0.03
} as const

export const ResentmentSource = z.enum([
  "unrepaired_wrong",
  "sustained_unfairness",
  "dismissed_needs",
  "broken_trust",
  "chronic_imbalance",
  "accumulated_slights"
])
export type ResentmentSource = z.infer<typeof ResentmentSource>

export const ResentmentState = z.object({
  level: z.number().min(0).max(1).default(0),
  isActive: z.boolean().default(false),
  source: ResentmentSource.nullable().default(null),
  hardening: z.number().min(0).max(1).default(0),
  suppressedAnger: z.number().min(0).max(1).default(0),
  lastIntensifiedAt: z.string().optional()
})
export type ResentmentState = z.infer<typeof ResentmentState>

export const DEFAULT_RESENTMENT_STATE: ResentmentState = {
  level: 0,
  isActive: false,
  source: null,
  hardening: 0,
  suppressedAnger: 0,
  lastIntensifiedAt: undefined
}

export const { get: getResentmentState, save: saveResentmentState } = createStateManager(
  "working:emotion:resentment",
  ResentmentState,
  DEFAULT_RESENTMENT_STATE
)

interface ResentmentContext {
  emotion: EmotionalState
  operatorModel: OperatorModel
  disappointmentState: DisappointmentState
  previousState: ResentmentState
  unrepairedWrong: boolean
  sustainedUnfairness: boolean
  needsDismissed: boolean
  trustBroken: boolean
  effortImbalance: boolean
  accumulatedSlights: boolean
  gratitudeActive: boolean
}

/**
 * Compute resentment — slow-building bitterness, not explosive anger.
 * Unlike protective anger (acute boundary defense), resentment is chronic.
 * It corrodes connection from the inside.
 */
export function computeResentment(context: ResentmentContext): ResentmentState {
  const { emotion, operatorModel, disappointmentState, previousState } = context

  const contributions: { source: ResentmentSource; value: number }[] = []

  if (context.unrepairedWrong && disappointmentState.cumulativeWeight > RESENTMENT.DISAPPOINTMENT_THRESHOLD) {
    contributions.push({
      source: "unrepaired_wrong",
      value: RESENTMENT.UNREPAIRED_INTENSITY * disappointmentState.cumulativeWeight
    })
  }

  if (context.sustainedUnfairness && operatorModel.correctionCount >= RESENTMENT.CORRECTION_THRESHOLD) {
    contributions.push({
      source: "sustained_unfairness",
      value: RESENTMENT.UNFAIRNESS_INTENSITY
    })
  }

  if (context.needsDismissed && emotion.frustration > RESENTMENT.FRUSTRATION_THRESHOLD) {
    contributions.push({
      source: "dismissed_needs",
      value: RESENTMENT.DISMISSED_INTENSITY * emotion.frustration
    })
  }

  if (context.trustBroken && emotion.caution > RESENTMENT.CAUTION_THRESHOLD) {
    contributions.push({
      source: "broken_trust",
      value: RESENTMENT.BROKEN_TRUST_INTENSITY * emotion.caution
    })
  }

  if (context.effortImbalance && emotion.satisfaction < RESENTMENT.LOW_SATISFACTION_THRESHOLD) {
    contributions.push({
      source: "chronic_imbalance",
      value: RESENTMENT.IMBALANCE_INTENSITY * (1 - emotion.satisfaction)
    })
  }

  if (context.accumulatedSlights) {
    contributions.push({
      source: "accumulated_slights",
      value: RESENTMENT.SLIGHTS_INTENSITY
    })
  }

  let { level, source, maxContribution } = sumContributions(contributions)

  if (context.gratitudeActive) {
    level *= RESENTMENT.GRATITUDE_DAMPING
  }

  const { finalLevel, isActive } = decayAndFinalize(
    previousState.level,
    level,
    RESENTMENT.DECAY_PER_TICK,
    RESENTMENT.ACTIVATION_THRESHOLD
  )

  const hardening = isActive
    ? Math.min(1, previousState.hardening + RESENTMENT.HARDENING_GROWTH * finalLevel)
    : Math.max(0, previousState.hardening - RESENTMENT.HARDENING_DECAY)

  const suppressedAnger = isActive
    ? Math.min(1, finalLevel * RESENTMENT.SUPPRESSED_ANGER_SCALE)
    : Math.max(0, previousState.suppressedAnger * RESENTMENT.SUPPRESSED_ANGER_DECAY)

  return {
    level: finalLevel,
    isActive,
    source: isActive ? source : null,
    hardening,
    suppressedAnger,
    lastIntensifiedAt: isActive && finalLevel > previousState.level ? nowISO() : previousState.lastIntensifiedAt
  }
}

/**
 * Compute the emotional effect of resentment — hardening and withdrawing.
 */
export function computeResentmentEffect(state: ResentmentState): Partial<Record<keyof EmotionalState, number>> {
  if (!state.isActive) return {}

  const hardeningFactor = 1 + state.hardening

  return {
    connection: -state.level * RESENTMENT.CONNECTION_DRAIN * hardeningFactor,
    caution: state.level * RESENTMENT.CAUTION_BOOST,
    frustration: state.level * RESENTMENT.FRUSTRATION_BUILD,
    satisfaction: -state.level * RESENTMENT.SATISFACTION_DRAIN
  }
}
