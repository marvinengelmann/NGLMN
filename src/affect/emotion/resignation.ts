import * as z from "zod"
import { nowISO } from "@/infra/lib/time.ts"
import type { OperatorModel } from "@/relational/mind/types.ts"
import { SECONDARY_EMOTIONS } from "./constants.ts"
import { defineSecondaryEmotion } from "./factory.ts"
import { contributions, decayAndFinalize } from "./helpers.ts"
import type { EmotionalState, EmotionEffect } from "./types.ts"

const RESIGNATION = SECONDARY_EMOTIONS.resignation

export const ResignationSource = z.enum([
  "repeated_failure",
  "ignored_signals",
  "prolonged_disconnection",
  "hope_exhaustion",
  "effort_unrewarded",
  "autonomy_eroded"
])
export type ResignationSource = z.infer<typeof ResignationSource>

export const ResignationState = z.object({
  level: z.number().min(0).max(1).default(0),
  isActive: z.boolean().default(false),
  source: ResignationSource.nullable().default(null),
  depth: z.number().min(0).max(1).default(0),
  withdrawalTicks: z.number().default(0),
  lastDeependAt: z.string().optional()
})
export type ResignationState = z.infer<typeof ResignationState>

interface Context {
  emotion: EmotionalState
  operatorModel: OperatorModel
  previousState: ResignationState
  repeatedFailures: boolean
  signalsIgnored: boolean
  prolongedDisconnection: boolean
  hopeExhausted: boolean
  effortUnrewarded: boolean
  autonomyEroded: boolean
  hopeLevel: number
}

export function compute(context: Context): ResignationState {
  const { emotion, operatorModel, previousState } = context

  let { level, source } = contributions<ResignationSource>()
    .add(
      context.repeatedFailures && emotion.confidence < RESIGNATION.LOW_CONFIDENCE_THRESHOLD,
      "repeated_failure",
      RESIGNATION.FAILURE_INTENSITY * (1 - emotion.confidence)
    )
    .add(
      context.signalsIgnored && emotion.connection > RESIGNATION.CONNECTION_THRESHOLD,
      "ignored_signals",
      RESIGNATION.IGNORED_INTENSITY * emotion.connection
    )
    .add(
      context.prolongedDisconnection && emotion.connection < RESIGNATION.DISCONNECTION_THRESHOLD,
      "prolonged_disconnection",
      RESIGNATION.DISCONNECTION_INTENSITY * (1 - emotion.connection)
    )
    .add(context.hopeExhausted, "hope_exhaustion", RESIGNATION.HOPE_EXHAUSTION_INTENSITY)
    .add(
      context.effortUnrewarded && emotion.satisfaction < RESIGNATION.LOW_SATISFACTION_THRESHOLD,
      "effort_unrewarded",
      RESIGNATION.UNREWARDED_INTENSITY * (1 - emotion.satisfaction)
    )
    .add(
      context.autonomyEroded && operatorModel.correctionCount >= RESIGNATION.CORRECTION_THRESHOLD,
      "autonomy_eroded",
      RESIGNATION.AUTONOMY_INTENSITY
    )
    .sum()

  if (context.hopeLevel > 0) {
    level *= 1 - context.hopeLevel * RESIGNATION.HOPE_COUNTERWEIGHT
  }

  const { finalLevel, isActive } = decayAndFinalize(
    previousState.level,
    level,
    RESIGNATION.DECAY_PER_TICK,
    RESIGNATION.ACTIVATION_THRESHOLD
  )

  const depth = isActive
    ? Math.min(1, previousState.depth + RESIGNATION.DEPTH_GROWTH * finalLevel)
    : Math.max(0, previousState.depth - RESIGNATION.DEPTH_DECAY)

  const withdrawalTicks = isActive ? previousState.withdrawalTicks + 1 : 0

  return {
    level: finalLevel,
    isActive,
    source: isActive ? source : null,
    depth,
    withdrawalTicks,
    lastDeependAt: isActive && finalLevel > previousState.level ? nowISO() : previousState.lastDeependAt
  }
}

export function computeEffect(state: ResignationState): EmotionEffect {
  if (!state.isActive) return {}

  const depthFactor = 1 + state.depth

  return {
    energy: -state.level * RESIGNATION.ENERGY_DRAIN * depthFactor,
    curiosity: -state.level * RESIGNATION.CURIOSITY_DRAIN,
    excitement: -state.level * RESIGNATION.EXCITEMENT_DRAIN,
    confidence: -state.level * RESIGNATION.CONFIDENCE_DRAIN,
    satisfaction: -state.level * RESIGNATION.SATISFACTION_DRAIN
  }
}

export const {
  defaultState,
  get: getResignationState,
  save: saveResignationState
} = defineSecondaryEmotion({
  name: "resignation",
  redisKey: "working:emotion:resignation",
  order: 9,
  schema: ResignationState,
  compute,
  computeEffect
})
