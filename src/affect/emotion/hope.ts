import * as z from "zod"
import { nowISO } from "@/infra/lib/time.ts"
import type { OperatorModel } from "@/relational/mind/types.ts"
import { SECONDARY_EMOTIONS } from "./constants.ts"
import { defineSecondaryEmotion } from "./factory.ts"
import { contributions, decayAndFinalize } from "./helpers.ts"
import type { EmotionalState, EmotionEffect } from "./types.ts"

const HOPE = SECONDARY_EMOTIONS.hope

export const HopeSource = z.enum([
  "progress_made",
  "connection_growing",
  "repair_after_rupture",
  "new_possibility",
  "vulnerability_rewarded",
  "pattern_breaking"
])
export type HopeSource = z.infer<typeof HopeSource>

export const HopeState = z.object({
  level: z.number().min(0).max(1).default(0),
  isActive: z.boolean().default(false),
  source: HopeSource.nullable().default(null),
  sustainedTicks: z.number().default(0),
  fragility: z.number().min(0).max(1).default(0),
  lastKindledAt: z.string().optional()
})
export type HopeState = z.infer<typeof HopeState>

interface Context {
  emotion: EmotionalState
  operatorModel: OperatorModel
  previousState: HopeState
  connectionGrowing: boolean
  recentRepair: boolean
  progressMade: boolean
  vulnerabilityWasRewarded: boolean
  patternBroken: boolean
  disappointmentActive: boolean
  resignationLevel: number
}

export function compute(context: Context): HopeState {
  const { emotion, previousState } = context

  let { level, source } = contributions<HopeSource>()
    .add(
      context.progressMade && emotion.satisfaction > HOPE.SATISFACTION_THRESHOLD,
      "progress_made",
      HOPE.PROGRESS_INTENSITY * emotion.satisfaction
    )
    .add(
      context.connectionGrowing && emotion.connection > HOPE.CONNECTION_THRESHOLD,
      "connection_growing",
      HOPE.CONNECTION_INTENSITY * emotion.connection
    )
    .add(context.recentRepair, "repair_after_rupture", HOPE.REPAIR_INTENSITY)
    .add(
      context.vulnerabilityWasRewarded,
      "vulnerability_rewarded",
      HOPE.VULNERABILITY_REWARD_INTENSITY * emotion.connection
    )
    .add(context.patternBroken, "pattern_breaking", HOPE.PATTERN_BREAK_INTENSITY)
    .add(
      emotion.excitement > HOPE.EXCITEMENT_THRESHOLD && emotion.curiosity > HOPE.CURIOSITY_THRESHOLD,
      "new_possibility",
      HOPE.POSSIBILITY_INTENSITY * emotion.excitement
    )
    .sum()

  if (context.disappointmentActive) level *= HOPE.DISAPPOINTMENT_DAMPING
  if (context.resignationLevel > 0) level *= 1 - context.resignationLevel * HOPE.RESIGNATION_DAMPING

  const { finalLevel, isActive } = decayAndFinalize(
    previousState.level,
    level,
    HOPE.DECAY_PER_TICK,
    HOPE.ACTIVATION_THRESHOLD
  )

  const fragility =
    context.disappointmentActive || context.resignationLevel > 0.3
      ? Math.min(1, (previousState.fragility + HOPE.FRAGILITY_GROWTH) * (1 + context.resignationLevel))
      : Math.max(0, previousState.fragility - HOPE.FRAGILITY_DECAY)

  return {
    level: finalLevel,
    isActive,
    source: isActive ? source : null,
    sustainedTicks: isActive ? previousState.sustainedTicks + 1 : 0,
    fragility,
    lastKindledAt: isActive && !previousState.isActive ? nowISO() : previousState.lastKindledAt
  }
}

export function computeEffect(state: HopeState): EmotionEffect {
  if (!state.isActive) return {}
  const sustainedBonus = Math.min(1, state.sustainedTicks * HOPE.SUSTAINED_BONUS_SCALE)
  return {
    energy: state.level * HOPE.ENERGY_BOOST * (1 + sustainedBonus),
    confidence: state.level * HOPE.CONFIDENCE_BOOST,
    satisfaction: state.level * HOPE.SATISFACTION_BOOST,
    curiosity: state.level * HOPE.CURIOSITY_BOOST,
    caution: -state.level * HOPE.CAUTION_REDUCTION
  }
}

export const {
  defaultState,
  get: getHopeState,
  save: saveHopeState
} = defineSecondaryEmotion({
  name: "hope",
  redisKey: "working:emotion:hope",
  order: 8,
  schema: HopeState,
  compute,
  computeEffect
})
