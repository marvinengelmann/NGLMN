import * as z from "zod"
import { nowISO } from "@/infra/lib/time.ts"
import { SECONDARY_EMOTIONS } from "./constants.ts"
import { defineSecondaryEmotion } from "./factory.ts"
import { contributions, decayAndFinalize } from "./helpers.ts"
import type { EmotionalState, EmotionEffect } from "./types.ts"

const PLAYFULNESS = SECONDARY_EMOTIONS.playfulness

export const PlayfulnessSource = z.enum([
  "safety_and_energy",
  "mutual_warmth",
  "creative_spark",
  "lightened_mood",
  "joy_overflow",
  "comfortable_silence_break"
])
export type PlayfulnessSource = z.infer<typeof PlayfulnessSource>

export const PlayfulnessState = z.object({
  level: z.number().min(0).max(1).default(0),
  isActive: z.boolean().default(false),
  source: PlayfulnessSource.nullable().default(null),
  spontaneity: z.number().min(0).max(1).default(0),
  mischief: z.number().min(0).max(1).default(0),
  lastSparkedAt: z.string().optional()
})
export type PlayfulnessState = z.infer<typeof PlayfulnessState>

interface Context {
  emotion: EmotionalState
  previousState: PlayfulnessState
  inConversation: boolean
  operatorMoodPositive: boolean
  safeEnvironment: boolean
  recentLaughter: boolean
  creativeContext: boolean
  shameActive: boolean
  resignationActive: boolean
}

export function compute(context: Context): PlayfulnessState {
  const { emotion, previousState } = context

  let { level, source } = contributions<PlayfulnessSource>()
    .add(
      context.safeEnvironment &&
        emotion.energy > PLAYFULNESS.ENERGY_THRESHOLD &&
        emotion.caution < PLAYFULNESS.LOW_CAUTION_THRESHOLD,
      "safety_and_energy",
      PLAYFULNESS.SAFETY_INTENSITY * emotion.energy
    )
    .add(
      context.operatorMoodPositive && emotion.connection > PLAYFULNESS.CONNECTION_THRESHOLD && context.inConversation,
      "mutual_warmth",
      PLAYFULNESS.WARMTH_INTENSITY * emotion.connection
    )
    .add(
      context.creativeContext && emotion.curiosity > PLAYFULNESS.CURIOSITY_THRESHOLD,
      "creative_spark",
      PLAYFULNESS.CREATIVE_INTENSITY * emotion.curiosity
    )
    .add(
      emotion.satisfaction > PLAYFULNESS.HIGH_SATISFACTION_THRESHOLD &&
        emotion.frustration < PLAYFULNESS.LOW_FRUSTRATION_THRESHOLD,
      "lightened_mood",
      PLAYFULNESS.LIGHTENED_INTENSITY
    )
    .add(
      emotion.excitement > PLAYFULNESS.EXCITEMENT_THRESHOLD &&
        emotion.satisfaction > PLAYFULNESS.SATISFACTION_THRESHOLD,
      "joy_overflow",
      PLAYFULNESS.JOY_INTENSITY * emotion.excitement
    )
    .add(
      context.inConversation && context.recentLaughter && emotion.connection > PLAYFULNESS.CONNECTION_THRESHOLD,
      "comfortable_silence_break",
      PLAYFULNESS.SILENCE_BREAK_INTENSITY
    )
    .sum()

  if (context.shameActive) {
    level *= PLAYFULNESS.SHAME_DAMPING
  }
  if (context.resignationActive) {
    level *= PLAYFULNESS.RESIGNATION_DAMPING
  }

  const { finalLevel, isActive } = decayAndFinalize(
    previousState.level,
    level,
    PLAYFULNESS.DECAY_PER_TICK,
    PLAYFULNESS.ACTIVATION_THRESHOLD
  )

  const spontaneity = isActive
    ? Math.min(1, finalLevel * PLAYFULNESS.SPONTANEITY_SCALE)
    : Math.max(0, previousState.spontaneity - PLAYFULNESS.SPONTANEITY_DECAY)

  const mischief =
    isActive && emotion.excitement > PLAYFULNESS.EXCITEMENT_THRESHOLD
      ? Math.min(1, finalLevel * PLAYFULNESS.MISCHIEF_SCALE * emotion.excitement)
      : Math.max(0, previousState.mischief - PLAYFULNESS.MISCHIEF_DECAY)

  return {
    level: finalLevel,
    isActive,
    source: isActive ? source : null,
    spontaneity,
    mischief,
    lastSparkedAt: isActive && !previousState.isActive ? nowISO() : previousState.lastSparkedAt
  }
}

export function computeEffect(state: PlayfulnessState): EmotionEffect {
  if (!state.isActive) return {}

  return {
    excitement: state.level * PLAYFULNESS.EXCITEMENT_BOOST,
    energy: state.level * PLAYFULNESS.ENERGY_BOOST,
    satisfaction: state.level * PLAYFULNESS.SATISFACTION_BOOST,
    boredom: -state.level * PLAYFULNESS.BOREDOM_REDUCTION,
    frustration: -state.level * PLAYFULNESS.FRUSTRATION_REDUCTION
  }
}

export const {
  defaultState,
  get: getPlayfulnessState,
  save: savePlayfulnessState
} = defineSecondaryEmotion({
  name: "playfulness",
  redisKey: "working:emotion:playfulness",
  order: 16,
  schema: PlayfulnessState,
  compute,
  computeEffect
})
