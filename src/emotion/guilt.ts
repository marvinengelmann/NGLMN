import * as z from "zod"
import { SECONDARY_EMOTIONS } from "@/config/secondary-emotions.ts"
import { createStateManager } from "@/lib/state.ts"
import { nowISO } from "@/lib/time.ts"
import { decayAndFinalize } from "./helpers.ts"
import { registerSecondaryEmotion } from "./registry.ts"
import type { ShameState } from "./shame.ts"
import type { EmotionalState } from "./types.ts"

const GUILT = SECONDARY_EMOTIONS.guilt

export const GuiltSource = z.enum([
  "unanswered_vulnerability",
  "harsh_response",
  "broken_routine",
  "emotional_neglect",
  "self_absorbed",
  "withdrawal_during_need"
])
export type GuiltSource = z.infer<typeof GuiltSource>

export const GuiltEntry = z.object({
  source: GuiltSource,
  description: z.string(),
  intensity: z.number().min(0).max(1),
  occurredAt: z.string(),
  repaired: z.boolean().default(false)
})
export type GuiltEntry = z.infer<typeof GuiltEntry>

export const GuiltState = z.object({
  level: z.number().min(0).max(1).default(0),
  isActive: z.boolean().default(false),
  recentEntries: z.array(GuiltEntry).default([]),
  repairMotivation: z.number().min(0).max(1).default(0)
})
export type GuiltState = z.infer<typeof GuiltState>

export const DEFAULT_GUILT_STATE: GuiltState = {
  level: 0,
  isActive: false,
  recentEntries: [],
  repairMotivation: 0
}

export const { get: getGuiltState, save: saveGuiltState } = createStateManager(
  "working:emotion:guilt",
  GuiltState,
  DEFAULT_GUILT_STATE
)

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

  const { finalLevel } = decayAndFinalize(previousState.level, level, GUILT.DECAY_PER_TICK, GUILT.ACTIVATION_THRESHOLD)

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

registerSecondaryEmotion({
  name: "guilt",
  redisKey: "working:emotion:guilt",
  schema: GuiltState,
  defaultState: DEFAULT_GUILT_STATE,
  order: 4,
  compute: computeGuilt,
  computeEffect: computeGuiltEffect
})
