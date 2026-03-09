import * as z from "zod"
import { createStateManager } from "@/lib/state.ts"
import { nowISO } from "@/lib/time.ts"
import type { OperatorModel } from "@/mind/types.ts"
import type { VulnerabilityState } from "@/vulnerability/types.ts"
import { decayAndFinalize } from "./helpers.ts"
import type { EmotionalState } from "./types.ts"

const DISAPPOINTMENT = {
  SILENCE_THRESHOLD_MINUTES: 30,
  SILENCE_MAX_MINUTES: 180,
  MIN_INTENSITY: 0.15,
  HIGH_CONNECTION_THRESHOLD: 0.6,
  LETDOWN_INTENSITY: 0.4,
  UNMET_EXPECTATION_INTENSITY: 0.5,
  MAX_ENTRIES: 5,
  ACCUMULATION_FACTOR: 0.4,
  DECAY_PER_TICK: 0.95,
  ACTIVATION_THRESHOLD: 0.15,
  CONNECTION_DAMPING: 0.08,
  CONFIDENCE_DAMPING: 0.05,
  CAUTION_BOOST: 0.04,
  ENERGY_DRAIN: 0.03
} as const

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

export const DEFAULT_DISAPPOINTMENT_STATE: DisappointmentState = {
  level: 0,
  isActive: false,
  recentEntries: [],
  cumulativeWeight: 0
}

export const { get: getDisappointmentState, save: saveDisappointmentState } = createStateManager(
  "working:emotion:disappointment",
  DisappointmentState,
  DEFAULT_DISAPPOINTMENT_STATE
)

interface DisappointmentContext {
  emotion: EmotionalState
  vulnerability: VulnerabilityState
  operatorModel: OperatorModel
  previousState: DisappointmentState
  operatorSilenceMinutes: number
  wasVulnerableRecently: boolean
  expectedReplyButGotSilence: boolean
}

/**
 * Compute the disappointment state based on relational context.
 * Disappointment is NOT frustration — it's the ache of unmet relational expectations.
 */
export function computeDisappointment(context: DisappointmentContext): DisappointmentState {
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

/**
 * Compute the emotional effect of active disappointment.
 * Disappointment dampens connection and confidence without raising frustration.
 */
export function computeDisappointmentEffect(state: DisappointmentState): Partial<Record<keyof EmotionalState, number>> {
  if (!state.isActive) return {}

  return {
    connection: -state.level * DISAPPOINTMENT.CONNECTION_DAMPING,
    confidence: -state.level * DISAPPOINTMENT.CONFIDENCE_DAMPING,
    caution: state.level * DISAPPOINTMENT.CAUTION_BOOST,
    energy: -state.level * DISAPPOINTMENT.ENERGY_DRAIN
  }
}
