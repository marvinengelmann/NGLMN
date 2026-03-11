import * as z from "zod"
import { nowISO } from "@/infra/lib/time.ts"
import { SECONDARY_EMOTIONS } from "./constants.ts"
import { defineSecondaryEmotion } from "./factory.ts"
import { decayAndFinalize } from "./helpers.ts"
import type { EmotionalState, EmotionEffect } from "./types.ts"

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

interface Context {
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

export function compute(context: Context): AnticipationState {
  const { emotion, previousState } = context

  let level = 0
  let source: AnticipationSource | null = null
  let maxContribution = 0
  let valenceSum = 0
  let valenceCount = 0

  const items: { source: AnticipationSource; value: number; valence: number }[] = []

  if (context.expectingInteraction && emotion.connection > ANTICIPATION.CONNECTION_THRESHOLD) {
    items.push({
      source: "expected_interaction",
      value: ANTICIPATION.INTERACTION_INTENSITY * emotion.connection,
      valence: 0.7
    })
  }

  if (context.progressMomentum && emotion.satisfaction > ANTICIPATION.SATISFACTION_THRESHOLD) {
    items.push({
      source: "progress_momentum",
      value: ANTICIPATION.MOMENTUM_INTENSITY * emotion.satisfaction,
      valence: 0.6
    })
  }

  if (context.plannedActivity) {
    items.push({
      source: "planned_activity",
      value: ANTICIPATION.PLANNED_INTENSITY,
      valence: 0.5
    })
  }

  if (context.positivePatternDetected && emotion.excitement > ANTICIPATION.EXCITEMENT_THRESHOLD) {
    items.push({
      source: "positive_pattern",
      value: ANTICIPATION.PATTERN_INTENSITY * emotion.excitement,
      valence: 0.8
    })
  }

  if (context.curiosityBuilding && emotion.curiosity > ANTICIPATION.CURIOSITY_THRESHOLD) {
    items.push({
      source: "curiosity_building",
      value: ANTICIPATION.CURIOSITY_INTENSITY * emotion.curiosity,
      valence: 0.6
    })
  }

  if (context.reunionApproaching && emotion.connection > ANTICIPATION.CONNECTION_THRESHOLD) {
    items.push({
      source: "reunion_approaching",
      value: ANTICIPATION.REUNION_INTENSITY * emotion.connection,
      valence: 0.9
    })
  }

  const accumulated = items.reduce(
    (acc, c) => ({
      level: acc.level + c.value,
      valenceSum: acc.valenceSum + c.valence * c.value,
      valenceCount: acc.valenceCount + c.value,
      maxContribution: Math.max(acc.maxContribution, c.value),
      source: c.value > acc.maxContribution ? c.source : acc.source
    }),
    { level: 0, valenceSum: 0, valenceCount: 0, maxContribution: 0, source: null as AnticipationSource | null }
  )
  level = accumulated.level
  source = accumulated.source
  maxContribution = accumulated.maxContribution
  valenceSum = accumulated.valenceSum
  valenceCount = accumulated.valenceCount

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

export function computeEffect(state: AnticipationState): EmotionEffect {
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

export const {
  defaultState,
  get: getAnticipationState,
  save: saveAnticipationState
} = defineSecondaryEmotion({
  name: "anticipation",
  redisKey: "working:emotion:anticipation",
  order: 13,
  schema: AnticipationState,
  compute,
  computeEffect
})
