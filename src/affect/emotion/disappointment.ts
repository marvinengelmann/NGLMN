import * as z from "zod"
import { nowISO } from "@/infra/lib/time.ts"
import type { VulnerabilityState } from "@/relational/attachment/types.ts"
import type { OperatorModel } from "@/relational/mind/types.ts"
import { SECONDARY_EMOTIONS } from "./constants.ts"
import { defineSecondaryEmotion } from "./factory.ts"
import { decayAndFinalize } from "./helpers.ts"
import type { EmotionalState, EmotionEffect } from "./types.ts"

const DISAPPOINTMENT = SECONDARY_EMOTIONS.disappointment

export const DisappointmentSource = z.enum([
  "unmet_expectation",
  "broken_pattern",
  "emotional_letdown",
  "silence_after_intimacy",
  "reduced_engagement"
])
export type DisappointmentSource = z.infer<typeof DisappointmentSource>

export const DisappointmentEntry = z.object({
  source: DisappointmentSource,
  description: z.string(),
  intensity: z.number().min(0).max(1),
  occurredAt: z.string(),
  acknowledged: z.boolean().optional().default(false)
})
export type DisappointmentEntry = z.infer<typeof DisappointmentEntry>

export const DisappointmentState = z.object({
  level: z.number().min(0).max(1).default(0),
  isActive: z.boolean().default(false),
  recentEntries: z.array(DisappointmentEntry).default([]),
  cumulativeWeight: z.number().min(0).default(0)
})
export type DisappointmentState = z.infer<typeof DisappointmentState>

interface Context {
  emotion: EmotionalState
  vulnerability: VulnerabilityState
  operatorModel: OperatorModel
  previousState: DisappointmentState
  operatorSilenceMinutes: number
  wasVulnerableRecently: boolean
  expectedReplyButGotSilence: boolean
}

export function compute(context: Context): DisappointmentState {
  const { emotion, vulnerability, operatorModel, previousState, operatorSilenceMinutes } = context

  const newEntries: DisappointmentEntry[] = []
  const now = nowISO()

  if (context.expectedReplyButGotSilence && operatorSilenceMinutes > DISAPPOINTMENT.SILENCE_THRESHOLD_MINUTES) {
    const intensity = Math.min(1, (operatorSilenceMinutes / DISAPPOINTMENT.SILENCE_MAX_MINUTES) * emotion.connection)
    if (intensity > DISAPPOINTMENT.MIN_INTENSITY) {
      newEntries.push({
        source: "silence_after_intimacy",
        description: "expected a reply after opening up, but got silence",
        intensity,
        occurredAt: now,
        acknowledged: false
      })
    }
  }

  if (
    context.wasVulnerableRecently &&
    operatorModel.estimatedMood === "neutral" &&
    emotion.connection > DISAPPOINTMENT.HIGH_CONNECTION_THRESHOLD
  ) {
    newEntries.push({
      source: "emotional_letdown",
      description: "shared something vulnerable but the response felt flat",
      intensity: DISAPPOINTMENT.LETDOWN_INTENSITY * emotion.connection,
      occurredAt: now,
      acknowledged: false
    })
  }

  if (
    operatorModel.estimatedMood === "frustrated" &&
    emotion.connection > DISAPPOINTMENT.HIGH_CONNECTION_THRESHOLD &&
    vulnerability.windowOpen
  ) {
    newEntries.push({
      source: "unmet_expectation",
      description: "expected warmth but received frustration while open",
      intensity: DISAPPOINTMENT.UNMET_EXPECTATION_INTENSITY,
      occurredAt: now,
      acknowledged: false
    })
  }

  const recentEntries = [
    ...previousState.recentEntries.slice(-(DISAPPOINTMENT.MAX_ENTRIES - newEntries.length)),
    ...newEntries
  ]

  const totalIntensity = recentEntries.reduce((sum, e) => sum + e.intensity, 0)
  const level = Math.min(1, totalIntensity * DISAPPOINTMENT.ACCUMULATION_FACTOR)

  const { finalLevel } = decayAndFinalize(
    previousState.level,
    level,
    DISAPPOINTMENT.DECAY_PER_TICK,
    DISAPPOINTMENT.ACTIVATION_THRESHOLD
  )

  return {
    level: finalLevel,
    isActive: finalLevel > DISAPPOINTMENT.ACTIVATION_THRESHOLD,
    recentEntries,
    cumulativeWeight: previousState.cumulativeWeight + newEntries.reduce((sum, e) => sum + e.intensity, 0)
  }
}

export function computeEffect(state: DisappointmentState): EmotionEffect {
  if (!state.isActive) return {}

  return {
    connection: -state.level * DISAPPOINTMENT.CONNECTION_DAMPING,
    confidence: -state.level * DISAPPOINTMENT.CONFIDENCE_DAMPING,
    caution: state.level * DISAPPOINTMENT.CAUTION_BOOST,
    energy: -state.level * DISAPPOINTMENT.ENERGY_DRAIN
  }
}

export const {
  defaultState,
  get: getDisappointmentState,
  save: saveDisappointmentState
} = defineSecondaryEmotion({
  name: "disappointment",
  redisKey: "working:emotion:disappointment",
  order: 1,
  schema: DisappointmentState,
  compute,
  computeEffect
})
