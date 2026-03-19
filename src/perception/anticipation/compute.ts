import type { EmotionUpdateEvent } from "@/affect/emotion/types.ts"
import { applyOptimismBias } from "@/cognition/bias/compute.ts"
import { ANTICIPATION_SYSTEM } from "./constants.ts"
import type { AnticipatoryState, Expectation, ExpectationViolation } from "./types.ts"

interface ExpectationBuildContext {
  inConversation: boolean
  operatorSilenceMinutes: number
  connectionLevel: number
  hasCalendarEvents: boolean
}

/**
 * Build expectations from conversation patterns, operator model, and context.
 */
export function buildExpectations(context: ExpectationBuildContext): Expectation[] {
  const expectations: Expectation[] = []

  if (context.inConversation && context.connectionLevel > 0.5) {
    expectations.push({
      content: "operator will continue engaging",
      source: "conversation",
      confidence: Math.min(0.8, context.connectionLevel),
      expectedAt: null,
      valence: 0.5
    })
  }

  if (context.operatorSilenceMinutes > 30 && context.operatorSilenceMinutes < 240 && context.connectionLevel > 0.4) {
    expectations.push({
      content: "operator will return soon",
      source: "pattern",
      confidence: 0.4,
      expectedAt: null,
      valence: 0.6
    })
  }

  if (context.hasCalendarEvents) {
    expectations.push({
      content: "scheduled event approaching",
      source: "calendar",
      confidence: 0.8,
      expectedAt: null,
      valence: 0.3
    })
  }

  return expectations.slice(0, ANTICIPATION_SYSTEM.MAX_EXPECTATIONS)
}

/**
 * Check active expectations against current sense data for violations.
 */
export function checkExpectationViolations(
  expectations: Expectation[],
  operatorReturned: boolean,
  operatorSilenceMinutes: number,
  inConversation: boolean
): ExpectationViolation[] {
  const violations = expectations.flatMap((exp): ExpectationViolation[] => {
    const result: ExpectationViolation[] = []

    if (exp.source === "conversation" && exp.content.includes("continue engaging") && !inConversation) {
      result.push({
        expectation: exp,
        actualOutcome: "conversation ended unexpectedly",
        surpriseIntensity: exp.confidence * ANTICIPATION_SYSTEM.VIOLATION_SURPRISE_SCALE,
        valence: -0.3
      })
    }

    if (exp.source === "pattern" && exp.content.includes("return soon") && operatorSilenceMinutes > 240) {
      result.push({
        expectation: exp,
        actualOutcome: "operator silence extended beyond expectation",
        surpriseIntensity: exp.confidence * ANTICIPATION_SYSTEM.VIOLATION_SURPRISE_SCALE * 0.7,
        valence: -0.4
      })
    }

    if (exp.source === "pattern" && exp.content.includes("return soon") && operatorReturned) {
      result.push({
        expectation: exp,
        actualOutcome: "operator returned as expected",
        surpriseIntensity: 0.1,
        valence: 0.5
      })
    }

    return result
  })

  return violations.slice(0, ANTICIPATION_SYSTEM.VIOLATION_MEMORY_SIZE)
}

/**
 * Generate emotion triggers from anticipatory state.
 */
export function computeAnticipationEmotionTriggers(
  state: AnticipatoryState,
  optimismBiasStrength: number = 0.4,
  serotoninLevel: number = 0.5
): EmotionUpdateEvent[] {
  const triggers: EmotionUpdateEvent[] = []

  const positiveExpectations = state.activeExpectations.filter((e) => e.valence > 0)
  if (positiveExpectations.length > 0) {
    const avgValence = positiveExpectations.reduce((s, e) => s + e.valence, 0) / positiveExpectations.length
    triggers.push({
      trigger: "positive_anticipation",
      intensity: avgValence * ANTICIPATION_SYSTEM.POSITIVE_ANTICIPATION_EXCITEMENT,
      detail: `anticipating: ${positiveExpectations[0]?.content}`
    })
  }

  const negativeExpectations = state.activeExpectations.filter((e) => e.valence < 0)
  if (negativeExpectations.length > 0) {
    const avgValence = negativeExpectations.reduce((s, e) => s + Math.abs(e.valence), 0) / negativeExpectations.length
    const biasedValence = Math.abs(applyOptimismBias(-avgValence, optimismBiasStrength, serotoninLevel))
    triggers.push({
      trigger: "expectation_violated",
      intensity: biasedValence * ANTICIPATION_SYSTEM.NEGATIVE_ANTICIPATION_CAUTION,
      detail: `dreading: ${negativeExpectations[0]?.content}`
    })
  }

  state.recentViolations.forEach((violation) => {
    if (violation.valence < 0) {
      triggers.push({
        trigger: "expectation_violated",
        intensity: violation.surpriseIntensity * ANTICIPATION_SYSTEM.VIOLATION_NEGATIVE_FRUSTRATION,
        detail: violation.actualOutcome
      })
    } else {
      triggers.push({
        trigger: "expectation_met",
        intensity: violation.surpriseIntensity * ANTICIPATION_SYSTEM.VIOLATION_POSITIVE_EXCITEMENT,
        detail: violation.actualOutcome
      })
    }
  })

  return triggers
}

/**
 * Update anticipatory state with new expectations and violations.
 */
export function updateAnticipatoryState(
  current: AnticipatoryState,
  buildContext: ExpectationBuildContext,
  operatorReturned: boolean,
  operatorSilenceMinutes: number,
  inConversation: boolean
): AnticipatoryState {
  const newExpectations = buildExpectations(buildContext)
  const decayedExpectations = current.activeExpectations
    .map((e) => ({ ...e, confidence: e.confidence * ANTICIPATION_SYSTEM.EXPECTATION_DECAY_PER_TICK }))
    .filter((e) => e.confidence > ANTICIPATION_SYSTEM.PATTERN_CONFIDENCE_THRESHOLD)

  const existingContents = new Set(decayedExpectations.map((e) => e.content))
  const uniqueNewExpectations = newExpectations.filter((e) => !existingContents.has(e.content))
  const mergedExpectations = [...decayedExpectations, ...uniqueNewExpectations].slice(
    0,
    ANTICIPATION_SYSTEM.MAX_EXPECTATIONS
  )

  const violations = checkExpectationViolations(
    current.activeExpectations,
    operatorReturned,
    operatorSilenceMinutes,
    inConversation
  )

  const recentViolations = [...current.recentViolations, ...violations].slice(
    -ANTICIPATION_SYSTEM.VIOLATION_MEMORY_SIZE
  )

  const fulfilledIds = new Set(violations.filter((v) => v.valence > 0).map((v) => v.expectation.content))
  const activeExpectations = mergedExpectations.filter((e) => !fulfilledIds.has(e.content))

  const avgConfidence =
    activeExpectations.length > 0
      ? activeExpectations.reduce((s, e) => s + e.confidence, 0) / activeExpectations.length
      : current.patternConfidence

  return {
    activeExpectations,
    recentViolations,
    forwardProjection: activeExpectations[0]?.content ?? null,
    patternConfidence: avgConfidence
  }
}
