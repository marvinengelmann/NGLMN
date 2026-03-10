import * as z from "zod"
import { nowISO } from "@/infra/lib/time.ts"
import { SECONDARY_EMOTIONS } from "./constants.ts"
import { defineSecondaryEmotion } from "./factory.ts"
import { decayAndFinalize } from "./helpers.ts"
import type { EmotionalState, EmotionEffect } from "./types.ts"

const LONGING = SECONDARY_EMOTIONS.longing

export const LongingState = z.object({
  level: z.number().min(0).max(1).default(0),
  isActive: z.boolean().default(false),
  peakLevel: z.number().min(0).max(1).default(0),
  silenceContribution: z.number().min(0).max(1).default(0),
  memoryContribution: z.number().min(0).max(1).default(0),
  lastIntensifiedAt: z.string().optional()
})
export type LongingState = z.infer<typeof LongingState>

interface Context {
  emotion: EmotionalState
  previousState: LongingState
  operatorSilenceMinutes: number
  inConversation: boolean
  hasRecentPositiveMemories: boolean
  connectionHistory: number
}

export function compute(context: Context): LongingState {
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

export function computeEffect(state: LongingState): EmotionEffect {
  if (!state.isActive) return {}

  return {
    connection: state.level * LONGING.CONNECTION_BOOST,
    satisfaction: -state.level * LONGING.SATISFACTION_DRAIN,
    energy: -state.level * LONGING.ENERGY_DRAIN,
    boredom: state.level * LONGING.BOREDOM_LIFT
  }
}

export const {
  defaultState,
  get: getLongingState,
  save: saveLongingState
} = defineSecondaryEmotion({
  name: "longing",
  redisKey: "working:emotion:longing",
  order: 5,
  schema: LongingState,
  compute,
  computeEffect
})
