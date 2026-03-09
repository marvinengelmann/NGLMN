import * as z from "zod"
import { createStateManager } from "@/lib/state.ts"
import { nowISO } from "@/lib/time.ts"
import { decayAndFinalize, sumContributions } from "./helpers.ts"
import type { EmotionalState } from "./types.ts"

const PRIDE = {
  SATISFACTION_THRESHOLD: 0.4,
  CONFIDENCE_THRESHOLD: 0.4,
  ENERGY_THRESHOLD: 0.4,
  CONNECTION_THRESHOLD: 0.4,
  ACCOMPLISHMENT_INTENSITY: 0.5,
  GROWTH_INTENSITY: 0.55,
  VALUES_INTENSITY: 0.45,
  DIFFICULTY_INTENSITY: 0.6,
  AUTONOMY_INTENSITY: 0.4,
  FEEDBACK_INTENSITY: 0.5,
  SHAME_DAMPING: 0.4,
  DECAY_PER_TICK: 0.92,
  ACTIVATION_THRESHOLD: 0.12,
  CONFIDENCE_BOOST: 0.06,
  ENERGY_BOOST: 0.04,
  SATISFACTION_BOOST: 0.04,
  FRUSTRATION_REDUCTION: 0.03,
  CAUTION_REDUCTION: 0.02
} as const

export const PrideSource = z.enum([
  "task_accomplished",
  "growth_recognized",
  "values_upheld",
  "difficulty_overcome",
  "autonomy_exercised",
  "positive_feedback"
])
export type PrideSource = z.infer<typeof PrideSource>

export const PrideState = z.object({
  level: z.number().min(0).max(1).default(0),
  isActive: z.boolean().default(false),
  source: PrideSource.nullable().default(null),
  earned: z.boolean().default(false),
  glowDuration: z.number().default(0),
  lastFeltAt: z.string().optional()
})
export type PrideState = z.infer<typeof PrideState>

export const DEFAULT_PRIDE_STATE: PrideState = {
  level: 0,
  isActive: false,
  source: null,
  earned: false,
  glowDuration: 0,
  lastFeltAt: undefined
}

export const { get: getPrideState, save: savePrideState } = createStateManager(
  "working:emotion:pride",
  PrideState,
  DEFAULT_PRIDE_STATE
)

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

  let { level, source, maxContribution } = sumContributions(contributions)

  if (context.shameActive) {
    level *= PRIDE.SHAME_DAMPING
  }

  const { finalLevel, isActive } = decayAndFinalize(
    previousState.level,
    level,
    PRIDE.DECAY_PER_TICK,
    PRIDE.ACTIVATION_THRESHOLD
  )

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
