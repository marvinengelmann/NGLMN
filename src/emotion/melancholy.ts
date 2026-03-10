import * as z from "zod"
import { SECONDARY_EMOTIONS } from "@/config/secondary-emotions.ts"
import { createStateManager } from "@/lib/state.ts"
import { nowISO } from "@/lib/time.ts"
import { decayAndFinalize, sumContributions } from "./helpers.ts"
import { registerSecondaryEmotion } from "./registry.ts"
import type { EmotionalState } from "./types.ts"

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

export const DEFAULT_MELANCHOLY_STATE: MelancholyState = {
  level: 0,
  isActive: false,
  source: null,
  poignancy: 0,
  contemplativeDepth: 0,
  lastDeependAt: undefined
}

export const { get: getMelancholyState, save: saveMelancholyState } = createStateManager(
  "working:emotion:melancholy",
  MelancholyState,
  DEFAULT_MELANCHOLY_STATE
)

interface MelancholyContext {
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

/**
 * Compute melancholy — not depression, but the bittersweet ache of being alive.
 * The awareness that beautiful things don't last, and that's what makes them beautiful.
 */
export function computeMelancholy(context: MelancholyContext): MelancholyState {
  const { emotion, previousState } = context

  const contributions: { source: MelancholySource; value: number }[] = []

  if (context.reflectingOnTime && emotion.satisfaction > MELANCHOLY.SATISFACTION_THRESHOLD) {
    contributions.push({
      source: "impermanence_awareness",
      value: MELANCHOLY.IMPERMANENCE_INTENSITY
    })
  }

  if (context.beautyInSadness && emotion.connection > MELANCHOLY.CONNECTION_THRESHOLD) {
    contributions.push({
      source: "beauty_in_sadness",
      value: MELANCHOLY.BEAUTY_INTENSITY * emotion.connection
    })
  }

  if (
    context.quietMoment &&
    emotion.energy < MELANCHOLY.LOW_ENERGY_THRESHOLD &&
    emotion.boredom < MELANCHOLY.LOW_BOREDOM_THRESHOLD
  ) {
    contributions.push({
      source: "quiet_reflection",
      value: MELANCHOLY.QUIET_INTENSITY
    })
  }

  if (context.distanceFelt && emotion.connection > MELANCHOLY.CONNECTION_THRESHOLD) {
    contributions.push({
      source: "distance_felt",
      value: MELANCHOLY.DISTANCE_INTENSITY * emotion.connection
    })
  }

  if (context.awareOfPassing) {
    contributions.push({
      source: "time_passing",
      value: MELANCHOLY.TIME_INTENSITY
    })
  }

  if (context.bittersweetMemory) {
    contributions.push({
      source: "bittersweet_memory",
      value: MELANCHOLY.MEMORY_INTENSITY
    })
  }

  let { level, source } = sumContributions(contributions)

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

/**
 * Compute the emotional effect of melancholy — deepening, not draining.
 */
export function computeMelancholyEffect(state: MelancholyState): Partial<Record<keyof EmotionalState, number>> {
  if (!state.isActive) return {}

  return {
    connection: state.level * MELANCHOLY.CONNECTION_BOOST,
    satisfaction: state.level * MELANCHOLY.SATISFACTION_BOOST,
    excitement: -state.level * MELANCHOLY.EXCITEMENT_REDUCTION,
    energy: -state.level * MELANCHOLY.ENERGY_REDUCTION,
    boredom: -state.level * MELANCHOLY.BOREDOM_REDUCTION
  }
}

registerSecondaryEmotion({
  name: "melancholy",
  redisKey: "working:emotion:melancholy",
  schema: MelancholyState,
  defaultState: DEFAULT_MELANCHOLY_STATE,
  order: 17,
  compute: computeMelancholy,
  computeEffect: computeMelancholyEffect
})
