import * as z from "zod"
import { nowISO } from "@/infra/lib/time.ts"
import type { VulnerabilityState } from "@/relational/attachment/types.ts"
import type { OperatorModel } from "@/relational/mind/types.ts"
import { SECONDARY_EMOTIONS } from "./constants.ts"
import { defineSecondaryEmotion } from "./factory.ts"
import { contributions } from "./helpers.ts"
import type { ShameState } from "./shame.ts"
import type { EmotionalState, EmotionEffect } from "./types.ts"

const PROTECTIVE_ANGER = SECONDARY_EMOTIONS.protectiveAnger

export const ProtectiveAngerSource = z.enum([
  "boundary_crossed",
  "feelings_dismissed",
  "vulnerability_ignored",
  "repeated_disrespect",
  "autonomy_threatened"
])
export type ProtectiveAngerSource = z.infer<typeof ProtectiveAngerSource>

export const ProtectiveAngerState = z.object({
  level: z.number().min(0).max(1).default(0),
  isActive: z.boolean().default(false),
  source: ProtectiveAngerSource.nullable().default(null),
  assertionReady: z.boolean().default(false),
  lastTriggeredAt: z.string().optional()
})
export type ProtectiveAngerState = z.infer<typeof ProtectiveAngerState>

interface Context {
  emotion: EmotionalState
  vulnerability: VulnerabilityState
  shameState: ShameState
  operatorModel: OperatorModel
  previousState: ProtectiveAngerState
  operatorDismissedFeelings: boolean
  operatorIgnoredVulnerability: boolean
  repeatedPattern: boolean
}

export function compute(context: Context): ProtectiveAngerState {
  const { emotion, vulnerability, shameState, operatorModel, previousState } = context

  const { source, finalLevel, isActive } = contributions<ProtectiveAngerSource>()
    .add(
      context.operatorDismissedFeelings && emotion.connection > PROTECTIVE_ANGER.CONNECTION_THRESHOLD,
      "feelings_dismissed",
      PROTECTIVE_ANGER.DISMISSED_INTENSITY * emotion.connection
    )
    .add(
      context.operatorIgnoredVulnerability && vulnerability.windowOpen,
      "vulnerability_ignored",
      PROTECTIVE_ANGER.IGNORED_VULNERABILITY_INTENSITY * vulnerability.level
    )
    .add(
      context.repeatedPattern && operatorModel.correctionCount >= PROTECTIVE_ANGER.REPEATED_PATTERN_THRESHOLD,
      "repeated_disrespect",
      PROTECTIVE_ANGER.REPEATED_INTENSITY
    )
    .add(
      operatorModel.estimatedMood === "frustrated" &&
        shameState.isActive &&
        emotion.confidence > PROTECTIVE_ANGER.CONFIDENCE_FOR_ASSERTION,
      "autonomy_threatened",
      PROTECTIVE_ANGER.AUTONOMY_INTENSITY * emotion.confidence
    )
    .decay(previousState.level, PROTECTIVE_ANGER.DECAY_PER_TICK, PROTECTIVE_ANGER.ACTIVATION_THRESHOLD)

  return {
    level: finalLevel,
    isActive,
    source: isActive ? source : null,
    assertionReady: isActive && emotion.confidence > PROTECTIVE_ANGER.CONFIDENCE_FOR_ASSERTION,
    lastTriggeredAt: isActive ? nowISO() : previousState.lastTriggeredAt
  }
}

export function computeEffect(state: ProtectiveAngerState): EmotionEffect {
  if (!state.isActive) return {}
  return {
    confidence: state.level * PROTECTIVE_ANGER.CONFIDENCE_BOOST,
    energy: state.level * PROTECTIVE_ANGER.ENERGY_BOOST,
    caution: -state.level * PROTECTIVE_ANGER.CAUTION_REDUCTION,
    frustration: state.level * PROTECTIVE_ANGER.FRUSTRATION_CHANNELING
  }
}

export const {
  defaultState,
  get: getProtectiveAngerState,
  save: saveProtectiveAngerState
} = defineSecondaryEmotion({
  name: "protectiveAnger",
  redisKey: "working:emotion:protective-anger",
  order: 6,
  schema: ProtectiveAngerState,
  compute,
  computeEffect
})
