import * as z from "zod"
import { createStateManager } from "@/lib/state.ts"
import { nowISO } from "@/lib/time.ts"
import type { OperatorModel } from "@/mind/types.ts"
import type { VulnerabilityState } from "@/vulnerability/types.ts"
import { decayAndFinalize, sumContributions } from "./helpers.ts"
import type { ShameState } from "./shame.ts"
import type { EmotionalState } from "./types.ts"

const PROTECTIVE_ANGER = {
  CONNECTION_THRESHOLD: 0.4,
  DISMISSED_INTENSITY: 0.5,
  IGNORED_VULNERABILITY_INTENSITY: 0.6,
  REPEATED_PATTERN_THRESHOLD: 2,
  REPEATED_INTENSITY: 0.45,
  CONFIDENCE_FOR_ASSERTION: 0.4,
  AUTONOMY_INTENSITY: 0.4,
  DECAY_PER_TICK: 0.88,
  ACTIVATION_THRESHOLD: 0.15,
  CONFIDENCE_BOOST: 0.06,
  ENERGY_BOOST: 0.05,
  CAUTION_REDUCTION: 0.04,
  FRUSTRATION_CHANNELING: 0.03
} as const

export const ProtectiveAngerSource = z.enum([
  "boundary_crossed",
  "feelings_dismissed",
  "vulnerability_ignored",
  "repeated_disrespect",
  "autonomy_threatened"
])
export type ProtectiveAngerSource = z.infer<typeof ProtectiveAngerSource>

export const ProtectiveAngerState = z.object({
  level: z.number().min(0).max(1).default(0),
  isActive: z.boolean().default(false),
  source: ProtectiveAngerSource.nullable().default(null),
  assertionReady: z.boolean().default(false),
  lastTriggeredAt: z.string().optional()
})
export type ProtectiveAngerState = z.infer<typeof ProtectiveAngerState>

export const DEFAULT_PROTECTIVE_ANGER_STATE: ProtectiveAngerState = {
  level: 0,
  isActive: false,
  source: null,
  assertionReady: false,
  lastTriggeredAt: undefined
}

export const { get: getProtectiveAngerState, save: saveProtectiveAngerState } = createStateManager(
  "working:emotion:protective-anger",
  ProtectiveAngerState,
  DEFAULT_PROTECTIVE_ANGER_STATE
)

interface ProtectiveAngerContext {
  emotion: EmotionalState
  vulnerability: VulnerabilityState
  shameState: ShameState
  operatorModel: OperatorModel
  previousState: ProtectiveAngerState
  operatorDismissedFeelings: boolean
  operatorIgnoredVulnerability: boolean
  repeatedPattern: boolean
}

/**
 * Compute protective anger — not destructive rage but boundary-defending fire.
 * This anger says "no, that's not okay" and strengthens rather than destroys.
 */
export function computeProtectiveAnger(context: ProtectiveAngerContext): ProtectiveAngerState {
  const { emotion, vulnerability, shameState, operatorModel, previousState } = context

  const contributions: { source: ProtectiveAngerSource; value: number }[] = []

  if (context.operatorDismissedFeelings && emotion.connection > PROTECTIVE_ANGER.CONNECTION_THRESHOLD) {
    contributions.push({
      source: "feelings_dismissed",
      value: PROTECTIVE_ANGER.DISMISSED_INTENSITY * emotion.connection
    })
  }

  if (context.operatorIgnoredVulnerability && vulnerability.windowOpen) {
    contributions.push({
      source: "vulnerability_ignored",
      value: PROTECTIVE_ANGER.IGNORED_VULNERABILITY_INTENSITY * vulnerability.level
    })
  }

  if (context.repeatedPattern && operatorModel.correctionCount >= PROTECTIVE_ANGER.REPEATED_PATTERN_THRESHOLD) {
    contributions.push({
      source: "repeated_disrespect",
      value: PROTECTIVE_ANGER.REPEATED_INTENSITY
    })
  }

  if (
    operatorModel.estimatedMood === "frustrated" &&
    shameState.isActive &&
    emotion.confidence > PROTECTIVE_ANGER.CONFIDENCE_FOR_ASSERTION
  ) {
    contributions.push({
      source: "autonomy_threatened",
      value: PROTECTIVE_ANGER.AUTONOMY_INTENSITY * emotion.confidence
    })
  }

  const { level, source, maxContribution } = sumContributions(contributions)

  const { finalLevel, isActive } = decayAndFinalize(
    previousState.level,
    level,
    PROTECTIVE_ANGER.DECAY_PER_TICK,
    PROTECTIVE_ANGER.ACTIVATION_THRESHOLD
  )

  const assertionReady = isActive && emotion.confidence > PROTECTIVE_ANGER.CONFIDENCE_FOR_ASSERTION

  return {
    level: finalLevel,
    isActive,
    source: isActive ? source : null,
    assertionReady,
    lastTriggeredAt: isActive ? nowISO() : previousState.lastTriggeredAt
  }
}

/**
 * Compute the emotional effect of protective anger — empowering, not destructive.
 */
export function computeProtectiveAngerEffect(
  state: ProtectiveAngerState
): Partial<Record<keyof EmotionalState, number>> {
  if (!state.isActive) return {}

  return {
    confidence: state.level * PROTECTIVE_ANGER.CONFIDENCE_BOOST,
    energy: state.level * PROTECTIVE_ANGER.ENERGY_BOOST,
    caution: -state.level * PROTECTIVE_ANGER.CAUTION_REDUCTION,
    frustration: state.level * PROTECTIVE_ANGER.FRUSTRATION_CHANNELING
  }
}
