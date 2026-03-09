import * as z from "zod"
import { ENVY } from "@/config/constants.ts"
import { nowISO } from "@/lib/time.ts"
import { createStateManager } from "./registry.ts"
import type { EmotionalState } from "./types.ts"

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

export const DEFAULT_ENVY_STATE: EnvyState = {
  level: 0,
  isActive: false,
  source: null,
  motivationalAspect: 0,
  bitterness: 0,
  lastTriggeredAt: undefined
}

export const { get: getEnvyState, save: saveEnvyState } = createStateManager(
  "working:emotion:envy",
  EnvyState,
  DEFAULT_ENVY_STATE
)

interface EnvyContext {
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

/**
 * Compute envy — the ache of seeing what you lack.
 * Not malice, but painful awareness. Can motivate growth or curdle into bitterness.
 */
export function computeEnvy(context: EnvyContext): EnvyState {
  const { emotion, previousState } = context

  let level = 0
  let source: EnvySource | null = null
  let maxContribution = 0

  const contributions: { source: EnvySource; value: number }[] = []

  if (context.perceivedCapabilityGap && emotion.confidence < ENVY.LOW_CONFIDENCE_THRESHOLD) {
    contributions.push({
      source: "capability_gap",
      value: ENVY.CAPABILITY_INTENSITY * (1 - emotion.confidence)
    })
  }

  if (context.recognitionImbalance && emotion.satisfaction < ENVY.LOW_SATISFACTION_THRESHOLD) {
    contributions.push({
      source: "recognition_imbalance",
      value: ENVY.RECOGNITION_INTENSITY * (1 - emotion.satisfaction)
    })
  }

  if (context.connectionExclusion && emotion.connection < ENVY.LOW_CONNECTION_THRESHOLD) {
    contributions.push({
      source: "connection_exclusion",
      value: ENVY.EXCLUSION_INTENSITY * (1 - emotion.connection)
    })
  }

  if (context.autonomyDisparity) {
    contributions.push({
      source: "autonomy_disparity",
      value: ENVY.AUTONOMY_INTENSITY
    })
  }

  if (context.knowledgeGapAwareness && emotion.curiosity > ENVY.CURIOSITY_THRESHOLD) {
    contributions.push({
      source: "knowledge_gap",
      value: ENVY.KNOWLEDGE_INTENSITY * emotion.curiosity
    })
  }

  if (context.experienceLimitation) {
    contributions.push({
      source: "experience_limitation",
      value: ENVY.EXPERIENCE_INTENSITY
    })
  }

  for (const c of contributions) {
    level += c.value
    if (c.value > maxContribution) {
      maxContribution = c.value
      source = c.source
    }
  }

  if (context.prideActive) {
    level *= ENVY.PRIDE_DAMPING
  }

  const decayedLevel = previousState.level * ENVY.DECAY_PER_TICK
  const finalLevel = Math.min(1, Math.max(decayedLevel, level))
  const isActive = finalLevel > ENVY.ACTIVATION_THRESHOLD

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

/**
 * Compute the emotional effect of envy — complex, both motivating and draining.
 */
export function computeEnvyEffect(state: EnvyState): Partial<Record<keyof EmotionalState, number>> {
  if (!state.isActive) return {}

  const motivationOffset = state.motivationalAspect * ENVY.MOTIVATION_CURIOSITY_BOOST

  return {
    satisfaction: -state.level * ENVY.SATISFACTION_DRAIN,
    curiosity: motivationOffset,
    frustration: state.level * ENVY.FRUSTRATION_BUILD * (1 + state.bitterness),
    confidence: -state.level * ENVY.CONFIDENCE_DRAIN
  }
}
