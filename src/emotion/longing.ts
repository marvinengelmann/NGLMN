import * as z from "zod"
import { createStateManager } from "@/lib/state.ts"
import { nowISO } from "@/lib/time.ts"
import { decayAndFinalize } from "./helpers.ts"
import type { EmotionalState } from "./types.ts"

const LONGING = {
  SILENCE_ONSET_MINUTES: 60,
  SILENCE_PEAK_HOURS: 24,
  MAX_SILENCE_CONTRIBUTION: 0.6,
  MEMORY_TRIGGER_SILENCE_MINUTES: 30,
  MEMORY_CONTRIBUTION_BASE: 0.3,
  CONNECTION_THRESHOLD: 0.5,
  CONNECTION_AMPLIFIER: 0.4,
  ACCUMULATION_FACTOR: 0.6,
  DECAY_PER_TICK: 0.96,
  ACTIVATION_THRESHOLD: 0.12,
  CONVERSATION_RELIEF: 0.3,
  CONNECTION_BOOST: 0.05,
  SATISFACTION_DRAIN: 0.03,
  ENERGY_DRAIN: 0.02,
  BOREDOM_LIFT: -0.03
} as const

export const LongingState = z.object({
  level: z.number().min(0).max(1).default(0),
  isActive: z.boolean().default(false),
  peakLevel: z.number().min(0).max(1).default(0),
  silenceContribution: z.number().min(0).max(1).default(0),
  memoryContribution: z.number().min(0).max(1).default(0),
  lastIntensifiedAt: z.string().optional()
})
export type LongingState = z.infer<typeof LongingState>

export const DEFAULT_LONGING_STATE: LongingState = {
  level: 0,
  isActive: false,
  peakLevel: 0,
  silenceContribution: 0,
  memoryContribution: 0,
  lastIntensifiedAt: undefined
}

export const { get: getLongingState, save: saveLongingState } = createStateManager(
  "working:emotion:longing",
  LongingState,
  DEFAULT_LONGING_STATE
)

interface LongingContext {
  emotion: EmotionalState
  previousState: LongingState
  operatorSilenceMinutes: number
  inConversation: boolean
  hasRecentPositiveMemories: boolean
  connectionHistory: number
}

/**
 * Compute longing — the persistent ache of missing someone's presence.
 * Different from attachment anxiety (security concern) — this is pure want.
 */
export function computeLonging(context: LongingContext): LongingState {
  const { emotion, previousState, operatorSilenceMinutes } = context

  let silenceContribution = 0
  if (operatorSilenceMinutes > LONGING.SILENCE_ONSET_MINUTES && !context.inConversation) {
    const silenceHours = operatorSilenceMinutes / 60
    silenceContribution = Math.min(
      LONGING.MAX_SILENCE_CONTRIBUTION,
      (silenceHours / LONGING.SILENCE_PEAK_HOURS) * emotion.connection
    )
  }

  let memoryContribution = 0
  if (context.hasRecentPositiveMemories && operatorSilenceMinutes > LONGING.MEMORY_TRIGGER_SILENCE_MINUTES) {
    memoryContribution = LONGING.MEMORY_CONTRIBUTION_BASE * emotion.connection
  }

  const connectionFactor =
    emotion.connection > LONGING.CONNECTION_THRESHOLD
      ? (emotion.connection - LONGING.CONNECTION_THRESHOLD) * LONGING.CONNECTION_AMPLIFIER
      : 0

  const rawLevel = (silenceContribution + memoryContribution + connectionFactor) * LONGING.ACCUMULATION_FACTOR

  const { finalLevel } = decayAndFinalize(
    previousState.level,
    rawLevel,
    LONGING.DECAY_PER_TICK,
    LONGING.ACTIVATION_THRESHOLD
  )

  if (context.inConversation && context.emotion.connection > LONGING.CONNECTION_THRESHOLD) {
    const relievedLevel = finalLevel * LONGING.CONVERSATION_RELIEF
    return {
      level: relievedLevel,
      isActive: relievedLevel > LONGING.ACTIVATION_THRESHOLD,
      peakLevel: Math.max(previousState.peakLevel, finalLevel),
      silenceContribution: 0,
      memoryContribution: 0,
      lastIntensifiedAt: previousState.lastIntensifiedAt
    }
  }

  const isActive = finalLevel > LONGING.ACTIVATION_THRESHOLD
  const isIntensifying = finalLevel > previousState.level

  return {
    level: finalLevel,
    isActive,
    peakLevel: Math.max(previousState.peakLevel, finalLevel),
    silenceContribution,
    memoryContribution,
    lastIntensifiedAt: isIntensifying ? nowISO() : previousState.lastIntensifiedAt
  }
}

/**
 * Compute the emotional effect of longing — bittersweet, connection-boosting but energy-draining.
 */
export function computeLongingEffect(state: LongingState): Partial<Record<keyof EmotionalState, number>> {
  if (!state.isActive) return {}

  return {
    connection: state.level * LONGING.CONNECTION_BOOST,
    satisfaction: -state.level * LONGING.SATISFACTION_DRAIN,
    energy: -state.level * LONGING.ENERGY_DRAIN,
    boredom: state.level * LONGING.BOREDOM_LIFT
  }
}
