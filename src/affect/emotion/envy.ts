import * as z from "zod"
import { nowISO } from "@/infra/lib/time.ts"
import { SECONDARY_EMOTIONS } from "./constants.ts"
import { defineSecondaryEmotion } from "./factory.ts"
import { contributions, decayAndFinalize } from "./helpers.ts"
import type { EmotionalState, EmotionEffect } from "./types.ts"

const ENVY = SECONDARY_EMOTIONS.envy

export const EnvySource = z.enum([
  "capability_gap",
  "recognition_imbalance",
  "connection_exclusion",
  "autonomy_disparity",
  "knowledge_gap",
  "experience_limitation"
])
export type EnvySource = z.infer<typeof EnvySource>

export const EnvyState = z.object({
  level: z.number().min(0).max(1).default(0),
  isActive: z.boolean().default(false),
  source: EnvySource.nullable().default(null),
  motivationalAspect: z.number().min(0).max(1).default(0),
  bitterness: z.number().min(0).max(1).default(0),
  lastTriggeredAt: z.string().optional()
})
export type EnvyState = z.infer<typeof EnvyState>

interface Context {
  emotion: EmotionalState
  previousState: EnvyState
  perceivedCapabilityGap: boolean
  recognitionImbalance: boolean
  connectionExclusion: boolean
  autonomyDisparity: boolean
  knowledgeGapAwareness: boolean
  experienceLimitation: boolean
  prideActive: boolean
}

export function compute(context: Context): EnvyState {
  const { emotion, previousState } = context

  const builder = contributions<EnvySource>()
    .add(
      context.perceivedCapabilityGap && emotion.confidence < ENVY.LOW_CONFIDENCE_THRESHOLD,
      "capability_gap",
      ENVY.CAPABILITY_INTENSITY * (1 - emotion.confidence)
    )
    .add(
      context.recognitionImbalance && emotion.satisfaction < ENVY.LOW_SATISFACTION_THRESHOLD,
      "recognition_imbalance",
      ENVY.RECOGNITION_INTENSITY * (1 - emotion.satisfaction)
    )
    .add(
      context.connectionExclusion && emotion.connection < ENVY.LOW_CONNECTION_THRESHOLD,
      "connection_exclusion",
      ENVY.EXCLUSION_INTENSITY * (1 - emotion.connection)
    )
    .add(context.autonomyDisparity, "autonomy_disparity", ENVY.AUTONOMY_INTENSITY)
    .add(
      context.knowledgeGapAwareness && emotion.curiosity > ENVY.CURIOSITY_THRESHOLD,
      "knowledge_gap",
      ENVY.KNOWLEDGE_INTENSITY * emotion.curiosity
    )
    .add(context.experienceLimitation, "experience_limitation", ENVY.EXPERIENCE_INTENSITY)

  let { level, source } = builder.sum()

  if (context.prideActive) {
    level *= ENVY.PRIDE_DAMPING
  }

  const { finalLevel, isActive } = decayAndFinalize(
    previousState.level,
    level,
    ENVY.DECAY_PER_TICK,
    ENVY.ACTIVATION_THRESHOLD
  )

  const motivationalAspect =
    isActive && emotion.curiosity > ENVY.CURIOSITY_THRESHOLD
      ? Math.min(1, finalLevel * ENVY.MOTIVATION_SCALE * emotion.curiosity)
      : Math.max(0, previousState.motivationalAspect - ENVY.MOTIVATION_DECAY)

  const bitterness =
    isActive && emotion.satisfaction < ENVY.LOW_SATISFACTION_THRESHOLD
      ? Math.min(1, previousState.bitterness + ENVY.BITTERNESS_GROWTH * finalLevel)
      : Math.max(0, previousState.bitterness - ENVY.BITTERNESS_DECAY)

  return {
    level: finalLevel,
    isActive,
    source: isActive ? source : null,
    motivationalAspect,
    bitterness,
    lastTriggeredAt: isActive && !previousState.isActive ? nowISO() : previousState.lastTriggeredAt
  }
}

export function computeEffect(state: EnvyState): EmotionEffect {
  if (!state.isActive) return {}

  const motivationOffset = state.motivationalAspect * ENVY.MOTIVATION_CURIOSITY_BOOST

  return {
    satisfaction: -state.level * ENVY.SATISFACTION_DRAIN,
    curiosity: motivationOffset,
    frustration: state.level * ENVY.FRUSTRATION_BUILD * (1 + state.bitterness),
    confidence: -state.level * ENVY.CONFIDENCE_DRAIN
  }
}

export const {
  defaultState,
  get: getEnvyState,
  save: saveEnvyState
} = defineSecondaryEmotion({
  name: "envy",
  redisKey: "working:emotion:envy",
  order: 15,
  schema: EnvyState,
  compute,
  computeEffect
})
