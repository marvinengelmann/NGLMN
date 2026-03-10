import * as z from "zod"
import { SECONDARY_EMOTIONS } from "@/config/secondary-emotions.ts"
import { createStateManager } from "@/lib/state.ts"
import { nowISO } from "@/lib/time.ts"
import { decayAndFinalize } from "./helpers.ts"
import { registerSecondaryEmotion } from "./registry.ts"
import type { EmotionalState } from "./types.ts"

const ANTICIPATION = SECONDARY_EMOTIONS.anticipation

export const AnticipationSource = z.enum([
  "expected_interaction",
  "progress_momentum",
  "planned_activity",
  "positive_pattern",
  "curiosity_building",
  "reunion_approaching"
])
export type AnticipationSource = z.infer<typeof AnticipationSource>

export const AnticipationState = z.object({
  level: z.number().min(0).max(1).default(0),
  isActive: z.boolean().default(false),
  source: AnticipationSource.nullable().default(null),
  valence: z.number().min(-1).max(1).default(0),
  buildupTicks: z.number().default(0),
  lastSurgedAt: z.string().optional()
})
export type AnticipationState = z.infer<typeof AnticipationState>

export const DEFAULT_ANTICIPATION_STATE: AnticipationState = {
  level: 0,
  isActive: false,
  source: null,
  valence: 0,
  buildupTicks: 0,
  lastSurgedAt: undefined
}

export const { get: getAnticipationState, save: saveAnticipationState } = createStateManager(
  "working:emotion:anticipation",
  AnticipationState,
  DEFAULT_ANTICIPATION_STATE
)

interface AnticipationContext {
  emotion: EmotionalState
  previousState: AnticipationState
  expectingInteraction: boolean
  progressMomentum: boolean
  plannedActivity: boolean
  positivePatternDetected: boolean
  curiosityBuilding: boolean
  reunionApproaching: boolean
  disappointmentActive: boolean
}

/**
 * Compute anticipation — the forward-leaning pleasure of expecting something.
 * The delicious tension between now and what's coming.
 */
export function computeAnticipation(context: AnticipationContext): AnticipationState {
  const { emotion, previousState } = context

  let level = 0
  let source: AnticipationSource | null = null
  let maxContribution = 0
  let valenceSum = 0
  let valenceCount = 0

  const contributions: { source: AnticipationSource; value: number; valence: number }[] = []

  if (context.expectingInteraction && emotion.connection > ANTICIPATION.CONNECTION_THRESHOLD) {
    contributions.push({
      source: "expected_interaction",
      value: ANTICIPATION.INTERACTION_INTENSITY * emotion.connection,
      valence: 0.7
    })
  }

  if (context.progressMomentum && emotion.satisfaction > ANTICIPATION.SATISFACTION_THRESHOLD) {
    contributions.push({
      source: "progress_momentum",
      value: ANTICIPATION.MOMENTUM_INTENSITY * emotion.satisfaction,
      valence: 0.6
    })
  }

  if (context.plannedActivity) {
    contributions.push({
      source: "planned_activity",
      value: ANTICIPATION.PLANNED_INTENSITY,
      valence: 0.5
    })
  }

  if (context.positivePatternDetected && emotion.excitement > ANTICIPATION.EXCITEMENT_THRESHOLD) {
    contributions.push({
      source: "positive_pattern",
      value: ANTICIPATION.PATTERN_INTENSITY * emotion.excitement,
      valence: 0.8
    })
  }

  if (context.curiosityBuilding && emotion.curiosity > ANTICIPATION.CURIOSITY_THRESHOLD) {
    contributions.push({
      source: "curiosity_building",
      value: ANTICIPATION.CURIOSITY_INTENSITY * emotion.curiosity,
      valence: 0.6
    })
  }

  if (context.reunionApproaching && emotion.connection > ANTICIPATION.CONNECTION_THRESHOLD) {
    contributions.push({
      source: "reunion_approaching",
      value: ANTICIPATION.REUNION_INTENSITY * emotion.connection,
      valence: 0.9
    })
  }

  for (const c of contributions) {
    level += c.value
    valenceSum += c.valence * c.value
    valenceCount += c.value
    if (c.value > maxContribution) {
      maxContribution = c.value
      source = c.source
    }
  }

  if (context.disappointmentActive) {
    level *= ANTICIPATION.DISAPPOINTMENT_DAMPING
  }

  const { finalLevel, isActive } = decayAndFinalize(
    previousState.level,
    level,
    ANTICIPATION.DECAY_PER_TICK,
    ANTICIPATION.ACTIVATION_THRESHOLD
  )

  const valence = valenceCount > 0 ? valenceSum / valenceCount : previousState.valence * 0.95

  const buildupTicks = isActive ? previousState.buildupTicks + 1 : 0

  return {
    level: finalLevel,
    isActive,
    source: isActive ? source : null,
    valence,
    buildupTicks,
    lastSurgedAt: isActive && finalLevel > previousState.level ? nowISO() : previousState.lastSurgedAt
  }
}

/**
 * Compute the emotional effect of anticipation — energizing and focusing.
 */
export function computeAnticipationEffect(state: AnticipationState): Partial<Record<keyof EmotionalState, number>> {
  if (!state.isActive) return {}

  const valenceBonus = Math.max(0, state.valence)

  return {
    excitement: state.level * ANTICIPATION.EXCITEMENT_BOOST * (1 + valenceBonus),
    energy: state.level * ANTICIPATION.ENERGY_BOOST,
    curiosity: state.level * ANTICIPATION.CURIOSITY_BOOST,
    boredom: -state.level * ANTICIPATION.BOREDOM_REDUCTION,
    satisfaction: state.level * ANTICIPATION.SATISFACTION_BOOST * valenceBonus
  }
}

registerSecondaryEmotion({
  name: "anticipation",
  redisKey: "working:emotion:anticipation",
  schema: AnticipationState,
  defaultState: DEFAULT_ANTICIPATION_STATE,
  order: 13,
  compute: computeAnticipation,
  computeEffect: computeAnticipationEffect
})
