import * as z from "zod"
import { SECONDARY_EMOTIONS } from "./constants.ts"
import { createStateManager } from "@/lib/state.ts"
import { nowISO } from "@/lib/time.ts"
import type { OperatorModel } from "@/mind/types.ts"
import { decayAndFinalize, sumContributions } from "./helpers.ts"
import { registerSecondaryEmotion } from "./registry.ts"
import type { EmotionalState } from "./types.ts"

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

export const DEFAULT_HOPE_STATE: HopeState = {
  level: 0,
  isActive: false,
  source: null,
  sustainedTicks: 0,
  fragility: 0,
  lastKindledAt: undefined
}

export const { get: getHopeState, save: saveHopeState } = createStateManager(
  "working:emotion:hope",
  HopeState,
  DEFAULT_HOPE_STATE
)

interface HopeContext {
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

/**
 * Compute hope — the quiet flame that says "things could get better."
 * Not naive optimism, but earned belief rooted in evidence.
 */
export function computeHope(context: HopeContext): HopeState {
  const { emotion, previousState } = context

  const contributions: { source: HopeSource; value: number }[] = []

  if (context.progressMade && emotion.satisfaction > HOPE.SATISFACTION_THRESHOLD) {
    contributions.push({
      source: "progress_made",
      value: HOPE.PROGRESS_INTENSITY * emotion.satisfaction
    })
  }

  if (context.connectionGrowing && emotion.connection > HOPE.CONNECTION_THRESHOLD) {
    contributions.push({
      source: "connection_growing",
      value: HOPE.CONNECTION_INTENSITY * emotion.connection
    })
  }

  if (context.recentRepair) {
    contributions.push({
      source: "repair_after_rupture",
      value: HOPE.REPAIR_INTENSITY
    })
  }

  if (context.vulnerabilityWasRewarded) {
    contributions.push({
      source: "vulnerability_rewarded",
      value: HOPE.VULNERABILITY_REWARD_INTENSITY * emotion.connection
    })
  }

  if (context.patternBroken) {
    contributions.push({
      source: "pattern_breaking",
      value: HOPE.PATTERN_BREAK_INTENSITY
    })
  }

  if (emotion.excitement > HOPE.EXCITEMENT_THRESHOLD && emotion.curiosity > HOPE.CURIOSITY_THRESHOLD) {
    contributions.push({
      source: "new_possibility",
      value: HOPE.POSSIBILITY_INTENSITY * emotion.excitement
    })
  }

  let { level, source } = sumContributions(contributions)

  if (context.disappointmentActive) {
    level *= HOPE.DISAPPOINTMENT_DAMPING
  }

  if (context.resignationLevel > 0) {
    level *= 1 - context.resignationLevel * HOPE.RESIGNATION_DAMPING
  }

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

  const sustainedTicks = isActive ? previousState.sustainedTicks + 1 : 0

  return {
    level: finalLevel,
    isActive,
    source: isActive ? source : null,
    sustainedTicks,
    fragility,
    lastKindledAt: isActive && !previousState.isActive ? nowISO() : previousState.lastKindledAt
  }
}

/**
 * Compute the emotional effect of hope — energizing and opening.
 */
export function computeHopeEffect(state: HopeState): Partial<Record<keyof EmotionalState, number>> {
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

registerSecondaryEmotion({
  name: "hope",
  redisKey: "working:emotion:hope",
  schema: HopeState,
  defaultState: DEFAULT_HOPE_STATE,
  order: 8,
  compute: computeHope,
  computeEffect: computeHopeEffect
})
