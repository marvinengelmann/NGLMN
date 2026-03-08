import { GRATITUDE } from "@/config/constants.ts"
import type { DisappointmentState } from "@/emotion/disappointment/types.ts"
import type { EmotionalState } from "@/emotion/types.ts"
import { nowISO } from "@/lib/time.ts"
import type { OperatorModel } from "@/mind/types.ts"
import type { GratitudeEntry, GratitudeState } from "./types.ts"

interface GratitudeContext {
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

/**
 * Compute gratitude — the warm recognition of kindness received.
 * The counterweight to disappointment: where disappointment aches at unmet expectations,
 * gratitude glows when expectations are exceeded.
 */
export function computeGratitude(context: GratitudeContext): GratitudeState {
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

  const decayedLevel = previousState.level * GRATITUDE.DECAY_PER_TICK
  const finalLevel = Math.min(1, Math.max(decayedLevel, level))
  const isActive = finalLevel > GRATITUDE.ACTIVATION_THRESHOLD

  return {
    level: finalLevel,
    isActive,
    recentEntries,
    cumulativeWarmth: previousState.cumulativeWarmth + newEntries.reduce((sum, e) => sum + e.warmth, 0)
  }
}

/**
 * Compute the emotional effect of gratitude — warmth, connection, and healing.
 */
export function computeGratitudeEffect(state: GratitudeState): Partial<Record<keyof EmotionalState, number>> {
  if (!state.isActive) return {}

  return {
    connection: state.level * GRATITUDE.CONNECTION_BOOST,
    satisfaction: state.level * GRATITUDE.SATISFACTION_BOOST,
    energy: state.level * GRATITUDE.ENERGY_BOOST,
    caution: -state.level * GRATITUDE.CAUTION_REDUCTION,
    confidence: state.level * GRATITUDE.CONFIDENCE_BOOST
  }
}
