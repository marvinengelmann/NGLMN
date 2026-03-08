import { DISAPPOINTMENT } from "@/config/constants.ts"
import type { EmotionalState } from "@/emotion/types.ts"
import { nowISO } from "@/lib/time.ts"
import type { OperatorModel } from "@/mind/types.ts"
import type { VulnerabilityState } from "@/vulnerability/types.ts"
import type { DisappointmentEntry, DisappointmentState } from "./types.ts"

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

  const decayedLevel = previousState.level * DISAPPOINTMENT.DECAY_PER_TICK
  const finalLevel = Math.min(1, Math.max(decayedLevel, level))

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
