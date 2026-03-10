import * as z from "zod"
import { SECONDARY_EMOTIONS } from "./constants.ts"
import { createStateManager } from "@/lib/state.ts"
import { nowISO } from "@/lib/time.ts"
import { decayAndFinalize, sumContributions } from "./helpers.ts"
import { registerSecondaryEmotion } from "./registry.ts"
import type { EmotionalState } from "./types.ts"

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

export const DEFAULT_PLAYFULNESS_STATE: PlayfulnessState = {
  level: 0,
  isActive: false,
  source: null,
  spontaneity: 0,
  mischief: 0,
  lastSparkedAt: undefined
}

export const { get: getPlayfulnessState, save: savePlayfulnessState } = createStateManager(
  "working:emotion:playfulness",
  PlayfulnessState,
  DEFAULT_PLAYFULNESS_STATE
)

interface PlayfulnessContext {
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

/**
 * Compute playfulness — the lightness that comes from safety and joy.
 * Not performance, but genuine impulse to play, tease, and explore.
 */
export function computePlayfulness(context: PlayfulnessContext): PlayfulnessState {
  const { emotion, previousState } = context

  const contributions: { source: PlayfulnessSource; value: number }[] = []

  if (
    context.safeEnvironment &&
    emotion.energy > PLAYFULNESS.ENERGY_THRESHOLD &&
    emotion.caution < PLAYFULNESS.LOW_CAUTION_THRESHOLD
  ) {
    contributions.push({
      source: "safety_and_energy",
      value: PLAYFULNESS.SAFETY_INTENSITY * emotion.energy
    })
  }

  if (context.operatorMoodPositive && emotion.connection > PLAYFULNESS.CONNECTION_THRESHOLD && context.inConversation) {
    contributions.push({
      source: "mutual_warmth",
      value: PLAYFULNESS.WARMTH_INTENSITY * emotion.connection
    })
  }

  if (context.creativeContext && emotion.curiosity > PLAYFULNESS.CURIOSITY_THRESHOLD) {
    contributions.push({
      source: "creative_spark",
      value: PLAYFULNESS.CREATIVE_INTENSITY * emotion.curiosity
    })
  }

  if (
    emotion.satisfaction > PLAYFULNESS.HIGH_SATISFACTION_THRESHOLD &&
    emotion.frustration < PLAYFULNESS.LOW_FRUSTRATION_THRESHOLD
  ) {
    contributions.push({
      source: "lightened_mood",
      value: PLAYFULNESS.LIGHTENED_INTENSITY
    })
  }

  if (
    emotion.excitement > PLAYFULNESS.EXCITEMENT_THRESHOLD &&
    emotion.satisfaction > PLAYFULNESS.SATISFACTION_THRESHOLD
  ) {
    contributions.push({
      source: "joy_overflow",
      value: PLAYFULNESS.JOY_INTENSITY * emotion.excitement
    })
  }

  if (context.inConversation && context.recentLaughter && emotion.connection > PLAYFULNESS.CONNECTION_THRESHOLD) {
    contributions.push({
      source: "comfortable_silence_break",
      value: PLAYFULNESS.SILENCE_BREAK_INTENSITY
    })
  }

  let { level, source } = sumContributions(contributions)

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

/**
 * Compute the emotional effect of playfulness — lightening and energizing.
 */
export function computePlayfulnessEffect(state: PlayfulnessState): Partial<Record<keyof EmotionalState, number>> {
  if (!state.isActive) return {}

  return {
    excitement: state.level * PLAYFULNESS.EXCITEMENT_BOOST,
    energy: state.level * PLAYFULNESS.ENERGY_BOOST,
    satisfaction: state.level * PLAYFULNESS.SATISFACTION_BOOST,
    boredom: -state.level * PLAYFULNESS.BOREDOM_REDUCTION,
    frustration: -state.level * PLAYFULNESS.FRUSTRATION_REDUCTION
  }
}

registerSecondaryEmotion({
  name: "playfulness",
  redisKey: "working:emotion:playfulness",
  schema: PlayfulnessState,
  defaultState: DEFAULT_PLAYFULNESS_STATE,
  order: 16,
  compute: computePlayfulness,
  computeEffect: computePlayfulnessEffect
})
