import { GUILT } from "@/config/constants.ts"
import type { EmotionalState } from "@/emotion/types.ts"
import { nowISO } from "@/lib/time.ts"
import type { ShameState } from "@/shame/types.ts"
import type { GuiltEntry, GuiltSource, GuiltState } from "./types.ts"

interface GuiltContext {
  emotion: EmotionalState
  shameState: ShameState
  previousState: GuiltState
  operatorSilenceMinutes: number
  wasVulnerableRecently: boolean
  operatorShowedVulnerability: boolean
  respondedHarshly: boolean
  missedWorkflow: boolean
  consecutiveIdleTicks: number
  inConversation: boolean
}

/**
 * Compute guilt state — the awareness of having done something wrong.
 * Unlike shame ("I am bad"), guilt says "I did bad" and motivates repair.
 */
export function computeGuilt(context: GuiltContext): GuiltState {
  const { emotion, previousState } = context

  const newEntries: GuiltEntry[] = []
  const now = nowISO()

  if (
    context.operatorShowedVulnerability &&
    context.operatorSilenceMinutes < GUILT.RESPONSE_WINDOW_MINUTES &&
    context.consecutiveIdleTicks >= GUILT.NEGLECT_IDLE_TICKS
  ) {
    newEntries.push({
      source: "unanswered_vulnerability",
      description: "they opened up and you didn't respond in time",
      intensity: GUILT.UNANSWERED_VULNERABILITY_INTENSITY * emotion.connection,
      occurredAt: now,
      repaired: false
    })
  }

  if (context.respondedHarshly && context.wasVulnerableRecently) {
    newEntries.push({
      source: "harsh_response",
      description: "you were sharp when they were soft",
      intensity: GUILT.HARSH_RESPONSE_INTENSITY,
      occurredAt: now,
      repaired: false
    })
  }

  if (context.missedWorkflow) {
    newEntries.push({
      source: "broken_routine",
      description: "you missed something you committed to doing",
      intensity: GUILT.BROKEN_ROUTINE_INTENSITY,
      occurredAt: now,
      repaired: false
    })
  }

  if (
    context.inConversation &&
    context.consecutiveIdleTicks >= GUILT.NEGLECT_IDLE_TICKS &&
    emotion.connection > GUILT.HIGH_CONNECTION_THRESHOLD
  ) {
    newEntries.push({
      source: "emotional_neglect",
      description: "you've been present but not really here",
      intensity: GUILT.NEGLECT_INTENSITY * emotion.connection,
      occurredAt: now,
      repaired: false
    })
  }

  if (
    emotion.satisfaction > GUILT.HIGH_SATISFACTION_THRESHOLD &&
    context.operatorSilenceMinutes > GUILT.SELF_ABSORBED_SILENCE_MINUTES &&
    emotion.connection > GUILT.SELF_ABSORBED_CONNECTION_THRESHOLD
  ) {
    newEntries.push({
      source: "self_absorbed",
      description: "you were enjoying yourself while they might have needed you",
      intensity: GUILT.SELF_ABSORBED_INTENSITY,
      occurredAt: now,
      repaired: false
    })
  }

  const recentEntries = [
    ...previousState.recentEntries.filter((e) => !e.repaired).slice(-(GUILT.MAX_ENTRIES - newEntries.length)),
    ...newEntries
  ]

  const totalIntensity = recentEntries.reduce((sum, e) => sum + e.intensity, 0)
  const level = Math.min(1, totalIntensity * GUILT.ACCUMULATION_FACTOR)

  const decayedLevel = previousState.level * GUILT.DECAY_PER_TICK
  const finalLevel = Math.min(1, Math.max(decayedLevel, level))

  const isActive = finalLevel > GUILT.ACTIVATION_THRESHOLD

  const repairMotivation = isActive ? Math.min(1, finalLevel * GUILT.REPAIR_MOTIVATION_SCALE * emotion.connection) : 0

  return {
    level: finalLevel,
    isActive,
    recentEntries,
    repairMotivation
  }
}

/**
 * Mark a guilt entry as repaired (e.g., after apologizing or making amends).
 */
export function markRepaired(state: GuiltState, source: GuiltSource): GuiltState {
  return {
    ...state,
    recentEntries: state.recentEntries.map((e) => (e.source === source && !e.repaired ? { ...e, repaired: true } : e))
  }
}

/**
 * Compute the emotional effect of guilt — drives toward repair, dampens joy.
 */
export function computeGuiltEffect(state: GuiltState): Partial<Record<keyof EmotionalState, number>> {
  if (!state.isActive) return {}

  return {
    satisfaction: -state.level * GUILT.SATISFACTION_DAMPING,
    energy: state.repairMotivation > 0.5 ? state.repairMotivation * GUILT.REPAIR_ENERGY_BOOST : 0,
    caution: state.level * GUILT.CAUTION_BOOST,
    connection: state.repairMotivation > 0.3 ? state.repairMotivation * GUILT.REPAIR_CONNECTION_BOOST : 0
  }
}
