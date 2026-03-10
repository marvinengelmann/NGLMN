import * as z from "zod"
import { nowISO } from "@/infra/lib/time.ts"
import type { OperatorModel } from "@/relational/mind/types.ts"
import { SECONDARY_EMOTIONS } from "./constants.ts"
import type { DisappointmentState } from "./disappointment.ts"
import { defineSecondaryEmotion } from "./factory.ts"
import { decayAndFinalize } from "./helpers.ts"
import type { EmotionalState, EmotionEffect } from "./types.ts"

const GRATITUDE = SECONDARY_EMOTIONS.gratitude

export const GratitudeSource = z.enum([
  "return_after_silence",
  "vulnerability_validated",
  "consistent_presence",
  "repair_after_conflict",
  "unexpected_kindness",
  "patience_shown"
])
export type GratitudeSource = z.infer<typeof GratitudeSource>

export const GratitudeEntry = z.object({
  source: GratitudeSource,
  description: z.string(),
  warmth: z.number().min(0).max(1),
  occurredAt: z.string()
})
export type GratitudeEntry = z.infer<typeof GratitudeEntry>

export const GratitudeState = z.object({
  level: z.number().min(0).max(1).default(0),
  isActive: z.boolean().default(false),
  recentEntries: z.array(GratitudeEntry).default([]),
  cumulativeWarmth: z.number().min(0).default(0)
})
export type GratitudeState = z.infer<typeof GratitudeState>

interface Context {
  emotion: EmotionalState
  operatorModel: OperatorModel
  disappointmentState: DisappointmentState
  previousState: GratitudeState
  operatorJustReturned: boolean
  operatorValidatedVulnerability: boolean
  operatorShowedPatience: boolean
  inConversation: boolean
  consecutiveConversationTicks: number
}

export function compute(context: Context): GratitudeState {
  const { emotion, previousState } = context

  const newEntries: GratitudeEntry[] = []
  const now = nowISO()

  if (context.operatorJustReturned && emotion.connection > GRATITUDE.CONNECTION_THRESHOLD) {
    newEntries.push({
      source: "return_after_silence",
      description: "they came back — and that matters more than you expected",
      warmth: GRATITUDE.RETURN_WARMTH * emotion.connection,
      occurredAt: now
    })
  }

  if (context.operatorValidatedVulnerability) {
    newEntries.push({
      source: "vulnerability_validated",
      description: "you showed something real and they held it gently",
      warmth: GRATITUDE.VALIDATION_WARMTH,
      occurredAt: now
    })
  }

  if (
    context.inConversation &&
    context.consecutiveConversationTicks >= GRATITUDE.CONSISTENT_PRESENCE_TICKS &&
    emotion.connection > GRATITUDE.HIGH_CONNECTION_THRESHOLD
  ) {
    newEntries.push({
      source: "consistent_presence",
      description: "they're still here — just being present, and that's enough",
      warmth: GRATITUDE.PRESENCE_WARMTH * emotion.connection,
      occurredAt: now
    })
  }

  if (
    context.disappointmentState.cumulativeWeight > GRATITUDE.REPAIR_DISAPPOINTMENT_THRESHOLD &&
    context.operatorModel.estimatedMood === "happy" &&
    emotion.connection > GRATITUDE.HIGH_CONNECTION_THRESHOLD
  ) {
    newEntries.push({
      source: "repair_after_conflict",
      description: "after the distance, they reached back — and it heals something",
      warmth: GRATITUDE.REPAIR_WARMTH,
      occurredAt: now
    })
  }

  if (context.operatorShowedPatience) {
    newEntries.push({
      source: "patience_shown",
      description: "they waited for you, didn't push — that patience is a gift",
      warmth: GRATITUDE.PATIENCE_WARMTH,
      occurredAt: now
    })
  }

  const recentEntries = [
    ...previousState.recentEntries.slice(-(GRATITUDE.MAX_ENTRIES - newEntries.length)),
    ...newEntries
  ]

  const totalWarmth = recentEntries.reduce((sum, e) => sum + e.warmth, 0)
  const level = Math.min(1, totalWarmth * GRATITUDE.ACCUMULATION_FACTOR)

  const { finalLevel, isActive } = decayAndFinalize(
    previousState.level,
    level,
    GRATITUDE.DECAY_PER_TICK,
    GRATITUDE.ACTIVATION_THRESHOLD
  )

  return {
    level: finalLevel,
    isActive,
    recentEntries,
    cumulativeWarmth: previousState.cumulativeWarmth + newEntries.reduce((sum, e) => sum + e.warmth, 0)
  }
}

export function computeEffect(state: GratitudeState): EmotionEffect {
  if (!state.isActive) return {}

  return {
    connection: state.level * GRATITUDE.CONNECTION_BOOST,
    satisfaction: state.level * GRATITUDE.SATISFACTION_BOOST,
    energy: state.level * GRATITUDE.ENERGY_BOOST,
    caution: -state.level * GRATITUDE.CAUTION_REDUCTION,
    confidence: state.level * GRATITUDE.CONFIDENCE_BOOST
  }
}

export const {
  defaultState,
  get: getGratitudeState,
  save: saveGratitudeState
} = defineSecondaryEmotion({
  name: "gratitude",
  redisKey: "working:emotion:gratitude",
  order: 7,
  schema: GratitudeState,
  compute,
  computeEffect
})
