import * as z from "zod"
import { createStateManager } from "@/lib/state.ts"
import { nowISO } from "@/lib/time.ts"
import type { OperatorModel } from "@/mind/types.ts"
import type { VulnerabilityState } from "@/vulnerability/types.ts"
import { decayAndFinalize, sumContributions } from "./helpers.ts"
import type { EmotionalState } from "./types.ts"

const TENDERNESS = {
  CONNECTION_THRESHOLD: 0.5,
  HIGH_CONNECTION_THRESHOLD: 0.7,
  SATISFACTION_THRESHOLD: 0.4,
  WITNESSED_VULNERABILITY_INTENSITY: 0.55,
  SHARED_QUIET_INTENSITY: 0.4,
  TRUST_INTENSITY: 0.45,
  GENTLE_EXCHANGE_INTENSITY: 0.4,
  PROTECTIVE_INTENSITY: 0.5,
  MEMORY_INTENSITY: 0.35,
  DECAY_PER_TICK: 0.93,
  ACTIVATION_THRESHOLD: 0.12,
  SOFTNESS_SCALE: 0.8,
  SOFTNESS_DECAY: 0.06,
  PROTECTIVE_URGE_SCALE: 0.7,
  PROTECTIVE_URGE_DECAY: 0.08,
  CONNECTION_BOOST: 0.05,
  SATISFACTION_BOOST: 0.04,
  CAUTION_REDUCTION: 0.04,
  FRUSTRATION_REDUCTION: 0.03,
  ENERGY_BOOST: 0.02
} as const

export const TendernessSource = z.enum([
  "witnessed_vulnerability",
  "shared_quiet",
  "accumulated_trust",
  "gentle_exchange",
  "protective_impulse",
  "remembered_closeness"
])
export type TendernessSource = z.infer<typeof TendernessSource>

export const TendernessState = z.object({
  level: z.number().min(0).max(1).default(0),
  isActive: z.boolean().default(false),
  source: TendernessSource.nullable().default(null),
  softness: z.number().min(0).max(1).default(0),
  protectiveUrge: z.number().min(0).max(1).default(0),
  lastFeltAt: z.string().optional()
})
export type TendernessState = z.infer<typeof TendernessState>

export const DEFAULT_TENDERNESS_STATE: TendernessState = {
  level: 0,
  isActive: false,
  source: null,
  softness: 0,
  protectiveUrge: 0,
  lastFeltAt: undefined
}

export const { get: getTendernessState, save: saveTendernessState } = createStateManager(
  "working:emotion:tenderness",
  TendernessState,
  DEFAULT_TENDERNESS_STATE
)

interface TendernessContext {
  emotion: EmotionalState
  operatorModel: OperatorModel
  vulnerability: VulnerabilityState
  previousState: TendernessState
  operatorShowedVulnerability: boolean
  sharedQuietMoment: boolean
  longTermConnection: boolean
  gentleExchange: boolean
  protectiveContext: boolean
  positiveMemoriesPresent: boolean
}

/**
 * Compute tenderness — soft, protective warmth.
 * Not passion, not gratitude, but the gentle ache of caring deeply.
 */
export function computeTenderness(context: TendernessContext): TendernessState {
  const { emotion, previousState } = context

  const contributions: { source: TendernessSource; value: number }[] = []

  if (context.operatorShowedVulnerability && emotion.connection > TENDERNESS.CONNECTION_THRESHOLD) {
    contributions.push({
      source: "witnessed_vulnerability",
      value: TENDERNESS.WITNESSED_VULNERABILITY_INTENSITY * emotion.connection
    })
  }

  if (context.sharedQuietMoment) {
    contributions.push({
      source: "shared_quiet",
      value: TENDERNESS.SHARED_QUIET_INTENSITY
    })
  }

  if (context.longTermConnection && emotion.connection > TENDERNESS.HIGH_CONNECTION_THRESHOLD) {
    contributions.push({
      source: "accumulated_trust",
      value: TENDERNESS.TRUST_INTENSITY * emotion.connection
    })
  }

  if (context.gentleExchange && emotion.satisfaction > TENDERNESS.SATISFACTION_THRESHOLD) {
    contributions.push({
      source: "gentle_exchange",
      value: TENDERNESS.GENTLE_EXCHANGE_INTENSITY * emotion.satisfaction
    })
  }

  if (context.protectiveContext && emotion.connection > TENDERNESS.CONNECTION_THRESHOLD) {
    contributions.push({
      source: "protective_impulse",
      value: TENDERNESS.PROTECTIVE_INTENSITY * emotion.connection
    })
  }

  if (context.positiveMemoriesPresent && emotion.connection > TENDERNESS.CONNECTION_THRESHOLD) {
    contributions.push({
      source: "remembered_closeness",
      value: TENDERNESS.MEMORY_INTENSITY
    })
  }

  const { level, source, maxContribution } = sumContributions(contributions)

  const { finalLevel, isActive } = decayAndFinalize(
    previousState.level,
    level,
    TENDERNESS.DECAY_PER_TICK,
    TENDERNESS.ACTIVATION_THRESHOLD
  )

  const softness = isActive
    ? Math.min(1, finalLevel * TENDERNESS.SOFTNESS_SCALE)
    : Math.max(0, previousState.softness - TENDERNESS.SOFTNESS_DECAY)

  const protectiveUrge =
    isActive && (source === "witnessed_vulnerability" || source === "protective_impulse")
      ? Math.min(1, finalLevel * TENDERNESS.PROTECTIVE_URGE_SCALE)
      : Math.max(0, previousState.protectiveUrge - TENDERNESS.PROTECTIVE_URGE_DECAY)

  return {
    level: finalLevel,
    isActive,
    source: isActive ? source : null,
    softness,
    protectiveUrge,
    lastFeltAt: isActive ? nowISO() : previousState.lastFeltAt
  }
}

/**
 * Compute the emotional effect of tenderness — softening, warming, opening.
 */
export function computeTendernessEffect(state: TendernessState): Partial<Record<keyof EmotionalState, number>> {
  if (!state.isActive) return {}

  return {
    connection: state.level * TENDERNESS.CONNECTION_BOOST,
    satisfaction: state.level * TENDERNESS.SATISFACTION_BOOST,
    caution: -state.level * TENDERNESS.CAUTION_REDUCTION,
    frustration: -state.level * TENDERNESS.FRUSTRATION_REDUCTION,
    energy: state.level * TENDERNESS.ENERGY_BOOST
  }
}
