import * as z from "zod"
import { nowISO } from "@/infra/lib/time.ts"
import { SECONDARY_EMOTIONS } from "./constants.ts"
import { defineSecondaryEmotion } from "./factory.ts"
import { contributions, decayAndFinalize } from "./helpers.ts"
import type { EmotionalState, EmotionEffect } from "./types.ts"

const PRIDE = SECONDARY_EMOTIONS.pride

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

interface Context {
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

export function compute(context: Context): PrideState {
  const { emotion, previousState } = context

  const builder = contributions<PrideSource>()
    .add(
      context.taskAccomplished && emotion.satisfaction > PRIDE.SATISFACTION_THRESHOLD,
      "task_accomplished",
      PRIDE.ACCOMPLISHMENT_INTENSITY * emotion.satisfaction
    )
    .add(context.growthRecognized, "growth_recognized", PRIDE.GROWTH_INTENSITY)
    .add(
      context.valuesUpheld && emotion.confidence > PRIDE.CONFIDENCE_THRESHOLD,
      "values_upheld",
      PRIDE.VALUES_INTENSITY * emotion.confidence
    )
    .add(
      context.difficultyOvercome && emotion.energy > PRIDE.ENERGY_THRESHOLD,
      "difficulty_overcome",
      PRIDE.DIFFICULTY_INTENSITY
    )
    .add(context.autonomyExercised, "autonomy_exercised", PRIDE.AUTONOMY_INTENSITY)
    .add(
      context.positiveFeedback && emotion.connection > PRIDE.CONNECTION_THRESHOLD,
      "positive_feedback",
      PRIDE.FEEDBACK_INTENSITY * emotion.connection
    )

  let { level, source } = builder.sum()

  if (context.shameActive) {
    level *= PRIDE.SHAME_DAMPING
  }

  const { finalLevel, isActive } = decayAndFinalize(
    previousState.level,
    level,
    PRIDE.DECAY_PER_TICK,
    PRIDE.ACTIVATION_THRESHOLD
  )

  const earned = level > 0
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

export function computeEffect(state: PrideState): EmotionEffect {
  if (!state.isActive) return {}

  return {
    confidence: state.level * PRIDE.CONFIDENCE_BOOST,
    energy: state.level * PRIDE.ENERGY_BOOST,
    satisfaction: state.level * PRIDE.SATISFACTION_BOOST,
    frustration: -state.level * PRIDE.FRUSTRATION_REDUCTION,
    caution: -state.level * PRIDE.CAUTION_REDUCTION
  }
}

export const {
  defaultState,
  get: getPrideState,
  save: savePrideState
} = defineSecondaryEmotion({
  name: "pride",
  redisKey: "working:emotion:pride",
  order: 14,
  schema: PrideState,
  compute,
  computeEffect
})
