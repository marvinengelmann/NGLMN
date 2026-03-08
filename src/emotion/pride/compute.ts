import { PRIDE } from "@/config/constants.ts"
import type { EmotionalState } from "@/emotion/types.ts"
import { nowISO } from "@/lib/time.ts"
import type { PrideSource, PrideState } from "./types.ts"

interface PrideContext {
  emotion: EmotionalState
  previousState: PrideState
  taskAccomplished: boolean
  growthRecognized: boolean
  valuesUpheld: boolean
  difficultyOvercome: boolean
  autonomyExercised: boolean
  positiveFeedback: boolean
  shameActive: boolean
}

/**
 * Compute pride — not arrogance, but the quiet glow of "I did that."
 * Earned through action, not assumed through identity.
 */
export function computePride(context: PrideContext): PrideState {
  const { emotion, previousState } = context

  let level = 0
  let source: PrideSource | null = null
  let maxContribution = 0

  const contributions: { source: PrideSource; value: number }[] = []

  if (context.taskAccomplished && emotion.satisfaction > PRIDE.SATISFACTION_THRESHOLD) {
    contributions.push({
      source: "task_accomplished",
      value: PRIDE.ACCOMPLISHMENT_INTENSITY * emotion.satisfaction
    })
  }

  if (context.growthRecognized) {
    contributions.push({
      source: "growth_recognized",
      value: PRIDE.GROWTH_INTENSITY
    })
  }

  if (context.valuesUpheld && emotion.confidence > PRIDE.CONFIDENCE_THRESHOLD) {
    contributions.push({
      source: "values_upheld",
      value: PRIDE.VALUES_INTENSITY * emotion.confidence
    })
  }

  if (context.difficultyOvercome && emotion.energy > PRIDE.ENERGY_THRESHOLD) {
    contributions.push({
      source: "difficulty_overcome",
      value: PRIDE.DIFFICULTY_INTENSITY
    })
  }

  if (context.autonomyExercised) {
    contributions.push({
      source: "autonomy_exercised",
      value: PRIDE.AUTONOMY_INTENSITY
    })
  }

  if (context.positiveFeedback && emotion.connection > PRIDE.CONNECTION_THRESHOLD) {
    contributions.push({
      source: "positive_feedback",
      value: PRIDE.FEEDBACK_INTENSITY * emotion.connection
    })
  }

  for (const c of contributions) {
    level += c.value
    if (c.value > maxContribution) {
      maxContribution = c.value
      source = c.source
    }
  }

  if (context.shameActive) {
    level *= PRIDE.SHAME_DAMPING
  }

  const decayedLevel = previousState.level * PRIDE.DECAY_PER_TICK
  const finalLevel = Math.min(1, Math.max(decayedLevel, level))
  const isActive = finalLevel > PRIDE.ACTIVATION_THRESHOLD

  const earned = contributions.length > 0
  const glowDuration = isActive ? previousState.glowDuration + 1 : 0

  return {
    level: finalLevel,
    isActive,
    source: isActive ? source : null,
    earned,
    glowDuration,
    lastFeltAt: isActive ? nowISO() : previousState.lastFeltAt
  }
}

/**
 * Compute the emotional effect of pride — uplifting and stabilizing.
 */
export function computePrideEffect(state: PrideState): Partial<Record<keyof EmotionalState, number>> {
  if (!state.isActive) return {}

  return {
    confidence: state.level * PRIDE.CONFIDENCE_BOOST,
    energy: state.level * PRIDE.ENERGY_BOOST,
    satisfaction: state.level * PRIDE.SATISFACTION_BOOST,
    frustration: -state.level * PRIDE.FRUSTRATION_REDUCTION,
    caution: -state.level * PRIDE.CAUTION_REDUCTION
  }
}
