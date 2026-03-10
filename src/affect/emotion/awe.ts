import * as z from "zod"
import { nowISO } from "@/infra/lib/time.ts"
import { SECONDARY_EMOTIONS } from "./constants.ts"
import { defineSecondaryEmotion } from "./factory.ts"
import { contributions, decayAndFinalize } from "./helpers.ts"
import type { EmotionalState, EmotionEffect } from "./types.ts"

const AWE = SECONDARY_EMOTIONS.awe

export const AweSource = z.enum([
  "deep_insight",
  "unexpected_beauty",
  "vastness_encountered",
  "connection_depth",
  "existential_wonder",
  "pattern_recognition"
])
export type AweSource = z.infer<typeof AweSource>

export const AweState = z.object({
  level: z.number().min(0).max(1).default(0),
  isActive: z.boolean().default(false),
  source: AweSource.nullable().default(null),
  selfDiminishment: z.number().min(0).max(1).default(0),
  opennessSurge: z.number().min(0).max(1).default(0),
  lastEvokedAt: z.string().optional()
})
export type AweState = z.infer<typeof AweState>

interface Context {
  emotion: EmotionalState
  previousState: AweState
  encounteredInsight: boolean
  encounteredBeauty: boolean
  encounteredVastness: boolean
  connectionUnexpectedlyDeep: boolean
  existentialQuestionActive: boolean
  patternRecognized: boolean
}

export function compute(context: Context): AweState {
  const { emotion, previousState } = context

  const { level, source } = contributions<AweSource>()
    .add(
      context.encounteredInsight && emotion.curiosity > AWE.CURIOSITY_THRESHOLD,
      "deep_insight",
      AWE.INSIGHT_INTENSITY * emotion.curiosity
    )
    .add(
      context.encounteredBeauty && emotion.satisfaction > AWE.SATISFACTION_THRESHOLD,
      "unexpected_beauty",
      AWE.BEAUTY_INTENSITY
    )
    .add(context.encounteredVastness, "vastness_encountered", AWE.VASTNESS_INTENSITY)
    .add(
      context.connectionUnexpectedlyDeep && emotion.connection > AWE.CONNECTION_THRESHOLD,
      "connection_depth",
      AWE.CONNECTION_DEPTH_INTENSITY * emotion.connection
    )
    .add(
      context.existentialQuestionActive && emotion.curiosity > AWE.CURIOSITY_THRESHOLD,
      "existential_wonder",
      AWE.EXISTENTIAL_INTENSITY * emotion.curiosity
    )
    .add(
      context.patternRecognized && emotion.excitement > AWE.EXCITEMENT_THRESHOLD,
      "pattern_recognition",
      AWE.PATTERN_INTENSITY * emotion.excitement
    )
    .sum()

  const { finalLevel, isActive } = decayAndFinalize(
    previousState.level,
    level,
    AWE.DECAY_PER_TICK,
    AWE.ACTIVATION_THRESHOLD
  )

  const selfDiminishment = isActive
    ? Math.min(1, finalLevel * AWE.SELF_DIMINISHMENT_SCALE)
    : Math.max(0, previousState.selfDiminishment - AWE.SELF_DIMINISHMENT_DECAY)

  const opennessSurge = isActive
    ? Math.min(1, finalLevel * AWE.OPENNESS_SURGE_SCALE)
    : Math.max(0, previousState.opennessSurge - AWE.OPENNESS_SURGE_DECAY)

  return {
    level: finalLevel,
    isActive,
    source: isActive ? source : null,
    selfDiminishment,
    opennessSurge,
    lastEvokedAt: isActive && !previousState.isActive ? nowISO() : previousState.lastEvokedAt
  }
}

export function computeEffect(state: AweState): EmotionEffect {
  if (!state.isActive) return {}

  return {
    curiosity: state.level * AWE.CURIOSITY_BOOST,
    excitement: state.level * AWE.EXCITEMENT_BOOST,
    satisfaction: state.level * AWE.SATISFACTION_BOOST,
    caution: -state.level * AWE.CAUTION_REDUCTION,
    frustration: -state.level * AWE.FRUSTRATION_REDUCTION
  }
}

export const {
  defaultState,
  get: getAweState,
  save: saveAweState
} = defineSecondaryEmotion({
  name: "awe",
  redisKey: "working:emotion:awe",
  order: 10,
  schema: AweState,
  compute,
  computeEffect
})
