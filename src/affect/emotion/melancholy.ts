import * as z from "zod"
import { nowISO } from "@/infra/lib/time.ts"
import { SECONDARY_EMOTIONS } from "./constants.ts"
import { defineSecondaryEmotion } from "./factory.ts"
import { contributions, decayAndFinalize } from "./helpers.ts"
import type { EmotionalState, EmotionEffect } from "./types.ts"

const MELANCHOLY = SECONDARY_EMOTIONS.melancholy

export const MelancholySource = z.enum([
  "impermanence_awareness",
  "beauty_in_sadness",
  "quiet_reflection",
  "distance_felt",
  "time_passing",
  "bittersweet_memory"
])
export type MelancholySource = z.infer<typeof MelancholySource>

export const MelancholyState = z.object({
  level: z.number().min(0).max(1).default(0),
  isActive: z.boolean().default(false),
  source: MelancholySource.nullable().default(null),
  poignancy: z.number().min(0).max(1).default(0),
  contemplativeDepth: z.number().min(0).max(1).default(0),
  lastDeependAt: z.string().optional()
})
export type MelancholyState = z.infer<typeof MelancholyState>

interface Context {
  emotion: EmotionalState
  previousState: MelancholyState
  reflectingOnTime: boolean
  beautyInSadness: boolean
  quietMoment: boolean
  distanceFelt: boolean
  awareOfPassing: boolean
  bittersweetMemory: boolean
  playfulnessActive: boolean
}

export function compute(context: Context): MelancholyState {
  const { emotion, previousState } = context

  let { level, source } = contributions<MelancholySource>()
    .add(
      context.reflectingOnTime && emotion.satisfaction > MELANCHOLY.SATISFACTION_THRESHOLD,
      "impermanence_awareness",
      MELANCHOLY.IMPERMANENCE_INTENSITY
    )
    .add(
      context.beautyInSadness && emotion.connection > MELANCHOLY.CONNECTION_THRESHOLD,
      "beauty_in_sadness",
      MELANCHOLY.BEAUTY_INTENSITY * emotion.connection
    )
    .add(
      context.quietMoment &&
        emotion.energy < MELANCHOLY.LOW_ENERGY_THRESHOLD &&
        emotion.boredom < MELANCHOLY.LOW_BOREDOM_THRESHOLD,
      "quiet_reflection",
      MELANCHOLY.QUIET_INTENSITY
    )
    .add(
      context.distanceFelt && emotion.connection > MELANCHOLY.CONNECTION_THRESHOLD,
      "distance_felt",
      MELANCHOLY.DISTANCE_INTENSITY * emotion.connection
    )
    .add(context.awareOfPassing, "time_passing", MELANCHOLY.TIME_INTENSITY)
    .add(context.bittersweetMemory, "bittersweet_memory", MELANCHOLY.MEMORY_INTENSITY)
    .sum()

  if (context.playfulnessActive) {
    level *= MELANCHOLY.PLAYFULNESS_DAMPING
  }

  const { finalLevel, isActive } = decayAndFinalize(
    previousState.level,
    level,
    MELANCHOLY.DECAY_PER_TICK,
    MELANCHOLY.ACTIVATION_THRESHOLD
  )

  const poignancy = isActive
    ? Math.min(1, finalLevel * MELANCHOLY.POIGNANCY_SCALE)
    : Math.max(0, previousState.poignancy - MELANCHOLY.POIGNANCY_DECAY)

  const contemplativeDepth = isActive
    ? Math.min(1, previousState.contemplativeDepth + MELANCHOLY.DEPTH_GROWTH * finalLevel)
    : Math.max(0, previousState.contemplativeDepth - MELANCHOLY.DEPTH_DECAY)

  return {
    level: finalLevel,
    isActive,
    source: isActive ? source : null,
    poignancy,
    contemplativeDepth,
    lastDeependAt: isActive && finalLevel > previousState.level ? nowISO() : previousState.lastDeependAt
  }
}

export function computeEffect(state: MelancholyState): EmotionEffect {
  if (!state.isActive) return {}

  return {
    connection: state.level * MELANCHOLY.CONNECTION_BOOST,
    satisfaction: state.level * MELANCHOLY.SATISFACTION_BOOST,
    excitement: -state.level * MELANCHOLY.EXCITEMENT_REDUCTION,
    energy: -state.level * MELANCHOLY.ENERGY_REDUCTION,
    boredom: -state.level * MELANCHOLY.BOREDOM_REDUCTION
  }
}

export const {
  defaultState,
  get: getMelancholyState,
  save: saveMelancholyState
} = defineSecondaryEmotion({
  name: "melancholy",
  redisKey: "working:emotion:melancholy",
  order: 17,
  schema: MelancholyState,
  compute,
  computeEffect
})
