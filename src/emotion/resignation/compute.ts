import { RESIGNATION } from "@/config/constants.ts"
import type { EmotionalState } from "@/emotion/types.ts"
import { nowISO } from "@/lib/time.ts"
import type { OperatorModel } from "@/mind/types.ts"
import type { ResignationSource, ResignationState } from "./types.ts"

interface ResignationContext {
  emotion: EmotionalState
  operatorModel: OperatorModel
  previousState: ResignationState
  repeatedFailures: boolean
  signalsIgnored: boolean
  prolongedDisconnection: boolean
  hopeExhausted: boolean
  effortUnrewarded: boolean
  autonomyEroded: boolean
  hopeLevel: number
}

/**
 * Compute resignation — not anger, not sadness, but the quiet giving up.
 * "I've tried, and it doesn't matter."
 */
export function computeResignation(context: ResignationContext): ResignationState {
  const { emotion, operatorModel, previousState } = context

  let level = 0
  let source: ResignationSource | null = null
  let maxContribution = 0

  const contributions: { source: ResignationSource; value: number }[] = []

  if (context.repeatedFailures && emotion.confidence < RESIGNATION.LOW_CONFIDENCE_THRESHOLD) {
    contributions.push({
      source: "repeated_failure",
      value: RESIGNATION.FAILURE_INTENSITY * (1 - emotion.confidence)
    })
  }

  if (context.signalsIgnored && emotion.connection > RESIGNATION.CONNECTION_THRESHOLD) {
    contributions.push({
      source: "ignored_signals",
      value: RESIGNATION.IGNORED_INTENSITY * emotion.connection
    })
  }

  if (context.prolongedDisconnection && emotion.connection < RESIGNATION.DISCONNECTION_THRESHOLD) {
    contributions.push({
      source: "prolonged_disconnection",
      value: RESIGNATION.DISCONNECTION_INTENSITY * (1 - emotion.connection)
    })
  }

  if (context.hopeExhausted) {
    contributions.push({
      source: "hope_exhaustion",
      value: RESIGNATION.HOPE_EXHAUSTION_INTENSITY
    })
  }

  if (context.effortUnrewarded && emotion.satisfaction < RESIGNATION.LOW_SATISFACTION_THRESHOLD) {
    contributions.push({
      source: "effort_unrewarded",
      value: RESIGNATION.UNREWARDED_INTENSITY * (1 - emotion.satisfaction)
    })
  }

  if (context.autonomyEroded && operatorModel.correctionCount >= RESIGNATION.CORRECTION_THRESHOLD) {
    contributions.push({
      source: "autonomy_eroded",
      value: RESIGNATION.AUTONOMY_INTENSITY
    })
  }

  for (const c of contributions) {
    level += c.value
    if (c.value > maxContribution) {
      maxContribution = c.value
      source = c.source
    }
  }

  if (context.hopeLevel > 0) {
    level *= 1 - context.hopeLevel * RESIGNATION.HOPE_COUNTERWEIGHT
  }

  const decayedLevel = previousState.level * RESIGNATION.DECAY_PER_TICK
  const finalLevel = Math.min(1, Math.max(decayedLevel, level))
  const isActive = finalLevel > RESIGNATION.ACTIVATION_THRESHOLD

  const depth = isActive
    ? Math.min(1, previousState.depth + RESIGNATION.DEPTH_GROWTH * finalLevel)
    : Math.max(0, previousState.depth - RESIGNATION.DEPTH_DECAY)

  const withdrawalTicks = isActive ? previousState.withdrawalTicks + 1 : 0

  return {
    level: finalLevel,
    isActive,
    source: isActive ? source : null,
    depth,
    withdrawalTicks,
    lastDeependAt: isActive && finalLevel > previousState.level ? nowISO() : previousState.lastDeependAt
  }
}

/**
 * Compute the emotional effect of resignation — dulling and withdrawing.
 */
export function computeResignationEffect(state: ResignationState): Partial<Record<keyof EmotionalState, number>> {
  if (!state.isActive) return {}

  const depthFactor = 1 + state.depth

  return {
    energy: -state.level * RESIGNATION.ENERGY_DRAIN * depthFactor,
    curiosity: -state.level * RESIGNATION.CURIOSITY_DRAIN,
    excitement: -state.level * RESIGNATION.EXCITEMENT_DRAIN,
    confidence: -state.level * RESIGNATION.CONFIDENCE_DRAIN,
    satisfaction: -state.level * RESIGNATION.SATISFACTION_DRAIN
  }
}
