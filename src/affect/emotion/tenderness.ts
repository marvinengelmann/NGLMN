import * as z from "zod"
import { nowISO } from "@/infra/lib/time.ts"
import type { VulnerabilityState } from "@/relational/attachment/types.ts"
import type { OperatorModel } from "@/relational/mind/types.ts"
import { SECONDARY_EMOTIONS } from "./constants.ts"
import { defineSecondaryEmotion } from "./factory.ts"
import { contributions, decayAndFinalize } from "./helpers.ts"
import type { EmotionalState, EmotionEffect } from "./types.ts"

const TENDERNESS = SECONDARY_EMOTIONS.tenderness

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

interface Context {
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

export function compute(context: Context): TendernessState {
  const { emotion, previousState } = context

  const { level, source } = contributions<TendernessSource>()
    .add(
      context.operatorShowedVulnerability && emotion.connection > TENDERNESS.CONNECTION_THRESHOLD,
      "witnessed_vulnerability",
      TENDERNESS.WITNESSED_VULNERABILITY_INTENSITY * emotion.connection
    )
    .add(context.sharedQuietMoment, "shared_quiet", TENDERNESS.SHARED_QUIET_INTENSITY)
    .add(
      context.longTermConnection && emotion.connection > TENDERNESS.HIGH_CONNECTION_THRESHOLD,
      "accumulated_trust",
      TENDERNESS.TRUST_INTENSITY * emotion.connection
    )
    .add(
      context.gentleExchange && emotion.satisfaction > TENDERNESS.SATISFACTION_THRESHOLD,
      "gentle_exchange",
      TENDERNESS.GENTLE_EXCHANGE_INTENSITY * emotion.satisfaction
    )
    .add(
      context.protectiveContext && emotion.connection > TENDERNESS.CONNECTION_THRESHOLD,
      "protective_impulse",
      TENDERNESS.PROTECTIVE_INTENSITY * emotion.connection
    )
    .add(
      context.positiveMemoriesPresent && emotion.connection > TENDERNESS.CONNECTION_THRESHOLD,
      "remembered_closeness",
      TENDERNESS.MEMORY_INTENSITY
    )
    .sum()

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

export function computeEffect(state: TendernessState): EmotionEffect {
  if (!state.isActive) return {}

  return {
    connection: state.level * TENDERNESS.CONNECTION_BOOST,
    satisfaction: state.level * TENDERNESS.SATISFACTION_BOOST,
    caution: -state.level * TENDERNESS.CAUTION_REDUCTION,
    frustration: -state.level * TENDERNESS.FRUSTRATION_REDUCTION,
    energy: state.level * TENDERNESS.ENERGY_BOOST
  }
}

export const {
  defaultState,
  get: getTendernessState,
  save: saveTendernessState
} = defineSecondaryEmotion({
  name: "tenderness",
  redisKey: "working:emotion:tenderness",
  order: 12,
  schema: TendernessState,
  compute,
  computeEffect
})
