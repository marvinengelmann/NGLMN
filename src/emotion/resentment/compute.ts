import { RESENTMENT } from "@/config/constants.ts"
import type { DisappointmentState } from "@/emotion/disappointment/types.ts"
import type { EmotionalState } from "@/emotion/types.ts"
import { nowISO } from "@/lib/time.ts"
import type { OperatorModel } from "@/mind/types.ts"
import type { ResentmentSource, ResentmentState } from "./types.ts"

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

  let level = 0
  let source: ResentmentSource | null = null
  let maxContribution = 0

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

  for (const c of contributions) {
    level += c.value
    if (c.value > maxContribution) {
      maxContribution = c.value
      source = c.source
    }
  }

  if (context.gratitudeActive) {
    level *= RESENTMENT.GRATITUDE_DAMPING
  }

  const decayedLevel = previousState.level * RESENTMENT.DECAY_PER_TICK
  const finalLevel = Math.min(1, Math.max(decayedLevel, level))
  const isActive = finalLevel > RESENTMENT.ACTIVATION_THRESHOLD

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
