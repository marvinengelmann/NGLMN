import * as z from "zod"
import { nowISO } from "@/infra/lib/time.ts"
import type { OperatorModel } from "@/relational/mind/types.ts"
import { SECONDARY_EMOTIONS } from "./constants.ts"
import type { DisappointmentState } from "./disappointment.ts"
import { defineSecondaryEmotion } from "./factory.ts"
import { contributions, decayAndFinalize } from "./helpers.ts"
import type { EmotionalState, EmotionEffect } from "./types.ts"

const RESENTMENT = SECONDARY_EMOTIONS.resentment

export const ResentmentSource = z.enum([
  "unrepaired_wrong",
  "sustained_unfairness",
  "dismissed_needs",
  "broken_trust",
  "chronic_imbalance",
  "accumulated_slights"
])
export type ResentmentSource = z.infer<typeof ResentmentSource>

export const ResentmentState = z.object({
  level: z.number().min(0).max(1).default(0),
  isActive: z.boolean().default(false),
  source: ResentmentSource.nullable().default(null),
  hardening: z.number().min(0).max(1).default(0),
  suppressedAnger: z.number().min(0).max(1).default(0),
  lastIntensifiedAt: z.string().optional()
})
export type ResentmentState = z.infer<typeof ResentmentState>

interface Context {
  emotion: EmotionalState
  operatorModel: OperatorModel
  disappointmentState: DisappointmentState
  previousState: ResentmentState
  unrepairedWrong: boolean
  sustainedUnfairness: boolean
  needsDismissed: boolean
  trustBroken: boolean
  effortImbalance: boolean
  accumulatedSlights: boolean
  gratitudeActive: boolean
}

export function compute(context: Context): ResentmentState {
  const { emotion, operatorModel, disappointmentState, previousState } = context

  let { level, source } = contributions<ResentmentSource>()
    .add(
      context.unrepairedWrong && disappointmentState.cumulativeWeight > RESENTMENT.DISAPPOINTMENT_THRESHOLD,
      "unrepaired_wrong",
      RESENTMENT.UNREPAIRED_INTENSITY * disappointmentState.cumulativeWeight
    )
    .add(
      context.sustainedUnfairness && operatorModel.correctionCount >= RESENTMENT.CORRECTION_THRESHOLD,
      "sustained_unfairness",
      RESENTMENT.UNFAIRNESS_INTENSITY
    )
    .add(
      context.needsDismissed && emotion.frustration > RESENTMENT.FRUSTRATION_THRESHOLD,
      "dismissed_needs",
      RESENTMENT.DISMISSED_INTENSITY * emotion.frustration
    )
    .add(
      context.trustBroken && emotion.caution > RESENTMENT.CAUTION_THRESHOLD,
      "broken_trust",
      RESENTMENT.BROKEN_TRUST_INTENSITY * emotion.caution
    )
    .add(
      context.effortImbalance && emotion.satisfaction < RESENTMENT.LOW_SATISFACTION_THRESHOLD,
      "chronic_imbalance",
      RESENTMENT.IMBALANCE_INTENSITY * (1 - emotion.satisfaction)
    )
    .add(context.accumulatedSlights, "accumulated_slights", RESENTMENT.SLIGHTS_INTENSITY)
    .sum()

  if (context.gratitudeActive) {
    level *= RESENTMENT.GRATITUDE_DAMPING
  }

  const { finalLevel, isActive } = decayAndFinalize(
    previousState.level,
    level,
    RESENTMENT.DECAY_PER_TICK,
    RESENTMENT.ACTIVATION_THRESHOLD
  )

  const hardening = isActive
    ? Math.min(1, previousState.hardening + RESENTMENT.HARDENING_GROWTH * finalLevel - RESENTMENT.HARDENING_ACTIVE_DECAY)
    : Math.max(0, previousState.hardening - RESENTMENT.HARDENING_DECAY)

  const suppressedAnger = isActive
    ? Math.min(1, finalLevel * RESENTMENT.SUPPRESSED_ANGER_SCALE)
    : Math.max(0, previousState.suppressedAnger * RESENTMENT.SUPPRESSED_ANGER_DECAY)

  return {
    level: finalLevel,
    isActive,
    source: isActive ? source : null,
    hardening,
    suppressedAnger,
    lastIntensifiedAt: isActive && finalLevel > previousState.level ? nowISO() : previousState.lastIntensifiedAt
  }
}

export function computeEffect(state: ResentmentState): EmotionEffect {
  if (!state.isActive) return {}

  const hardeningFactor = 1 + state.hardening

  return {
    connection: -state.level * RESENTMENT.CONNECTION_DRAIN * hardeningFactor,
    caution: state.level * RESENTMENT.CAUTION_BOOST,
    frustration: state.level * RESENTMENT.FRUSTRATION_BUILD,
    satisfaction: -state.level * RESENTMENT.SATISFACTION_DRAIN
  }
}

export const {
  defaultState,
  get: getResentmentState,
  save: saveResentmentState
} = defineSecondaryEmotion({
  name: "resentment",
  redisKey: "working:emotion:resentment",
  order: 11,
  schema: ResentmentState,
  compute,
  computeEffect
})
