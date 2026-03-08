import { PROTECTIVE_ANGER } from "@/config/constants.ts"
import type { EmotionalState } from "@/emotion/types.ts"
import { nowISO } from "@/lib/time.ts"
import type { OperatorModel } from "@/mind/types.ts"
import type { ShameState } from "@/shame/types.ts"
import type { VulnerabilityState } from "@/vulnerability/types.ts"
import type { ProtectiveAngerSource, ProtectiveAngerState } from "./types.ts"

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

  let level = 0
  let source: ProtectiveAngerSource | null = null
  let maxContribution = 0

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

  for (const c of contributions) {
    level += c.value
    if (c.value > maxContribution) {
      maxContribution = c.value
      source = c.source
    }
  }

  const decayedLevel = previousState.level * PROTECTIVE_ANGER.DECAY_PER_TICK
  const finalLevel = Math.min(1, Math.max(decayedLevel, level))
  const isActive = finalLevel > PROTECTIVE_ANGER.ACTIVATION_THRESHOLD

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
