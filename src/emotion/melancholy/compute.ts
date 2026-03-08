import { MELANCHOLY } from "@/config/constants.ts"
import type { EmotionalState } from "@/emotion/types.ts"
import { nowISO } from "@/lib/time.ts"
import type { MelancholySource, MelancholyState } from "./types.ts"

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

  let level = 0
  let source: MelancholySource | null = null
  let maxContribution = 0

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

  for (const c of contributions) {
    level += c.value
    if (c.value > maxContribution) {
      maxContribution = c.value
      source = c.source
    }
  }

  if (context.playfulnessActive) {
    level *= MELANCHOLY.PLAYFULNESS_DAMPING
  }

  const decayedLevel = previousState.level * MELANCHOLY.DECAY_PER_TICK
  const finalLevel = Math.min(1, Math.max(decayedLevel, level))
  const isActive = finalLevel > MELANCHOLY.ACTIVATION_THRESHOLD

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
