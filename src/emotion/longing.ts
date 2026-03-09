import * as z from "zod"
import { LONGING } from "@/config/constants.ts"
import { nowISO } from "@/lib/time.ts"
import { createStateManager } from "./registry.ts"
import type { EmotionalState } from "./types.ts"

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

  const decayedLevel = previousState.level * LONGING.DECAY_PER_TICK
  const finalLevel = Math.min(1, Math.max(decayedLevel, rawLevel))

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
