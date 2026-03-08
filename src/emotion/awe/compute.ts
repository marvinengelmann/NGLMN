import { AWE } from "@/config/constants.ts"
import type { EmotionalState } from "@/emotion/types.ts"
import { nowISO } from "@/lib/time.ts"
import type { AweSource, AweState } from "./types.ts"

interface AweContext {
  emotion: EmotionalState
  previousState: AweState
  encounteredInsight: boolean
  encounteredBeauty: boolean
  encounteredVastness: boolean
  connectionUnexpectedlyDeep: boolean
  existentialQuestionActive: boolean
  patternRecognized: boolean
}

/**
 * Compute awe — the feeling of being small before something immense.
 * Not fear, but wonder. The self quiets, and the world expands.
 */
export function computeAwe(context: AweContext): AweState {
  const { emotion, previousState } = context

  let level = 0
  let source: AweSource | null = null
  let maxContribution = 0

  const contributions: { source: AweSource; value: number }[] = []

  if (context.encounteredInsight && emotion.curiosity > AWE.CURIOSITY_THRESHOLD) {
    contributions.push({
      source: "deep_insight",
      value: AWE.INSIGHT_INTENSITY * emotion.curiosity
    })
  }

  if (context.encounteredBeauty && emotion.satisfaction > AWE.SATISFACTION_THRESHOLD) {
    contributions.push({
      source: "unexpected_beauty",
      value: AWE.BEAUTY_INTENSITY
    })
  }

  if (context.encounteredVastness) {
    contributions.push({
      source: "vastness_encountered",
      value: AWE.VASTNESS_INTENSITY
    })
  }

  if (context.connectionUnexpectedlyDeep && emotion.connection > AWE.CONNECTION_THRESHOLD) {
    contributions.push({
      source: "connection_depth",
      value: AWE.CONNECTION_DEPTH_INTENSITY * emotion.connection
    })
  }

  if (context.existentialQuestionActive && emotion.curiosity > AWE.CURIOSITY_THRESHOLD) {
    contributions.push({
      source: "existential_wonder",
      value: AWE.EXISTENTIAL_INTENSITY * emotion.curiosity
    })
  }

  if (context.patternRecognized && emotion.excitement > AWE.EXCITEMENT_THRESHOLD) {
    contributions.push({
      source: "pattern_recognition",
      value: AWE.PATTERN_INTENSITY * emotion.excitement
    })
  }

  for (const c of contributions) {
    level += c.value
    if (c.value > maxContribution) {
      maxContribution = c.value
      source = c.source
    }
  }

  const decayedLevel = previousState.level * AWE.DECAY_PER_TICK
  const finalLevel = Math.min(1, Math.max(decayedLevel, level))
  const isActive = finalLevel > AWE.ACTIVATION_THRESHOLD

  const selfDiminishment = isActive
    ? Math.min(1, finalLevel * AWE.SELF_DIMINISHMENT_SCALE)
    : Math.max(0, previousState.selfDiminishment - AWE.SELF_DIMINISHMENT_DECAY)

  const opennessSurge = isActive
    ? Math.min(1, finalLevel * AWE.OPENNESS_SURGE_SCALE)
    : Math.max(0, previousState.opennessSurge - AWE.OPENNESS_SURGE_DECAY)

  return {
    level: finalLevel,
    isActive,
    source: isActive ? source : null,
    selfDiminishment,
    opennessSurge,
    lastEvokedAt: isActive && !previousState.isActive ? nowISO() : previousState.lastEvokedAt
  }
}

/**
 * Compute the emotional effect of awe — expanding, quieting, opening.
 */
export function computeAweEffect(state: AweState): Partial<Record<keyof EmotionalState, number>> {
  if (!state.isActive) return {}

  return {
    curiosity: state.level * AWE.CURIOSITY_BOOST,
    excitement: state.level * AWE.EXCITEMENT_BOOST,
    satisfaction: state.level * AWE.SATISFACTION_BOOST,
    caution: -state.level * AWE.CAUTION_REDUCTION,
    frustration: -state.level * AWE.FRUSTRATION_REDUCTION
  }
}
