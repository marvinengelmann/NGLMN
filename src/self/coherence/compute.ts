import type { DriveState } from "@/affect/drive/types.ts"
import type { EmotionalState } from "@/affect/emotion/types.ts"
import type { SomaticState } from "@/affect/soma/types.ts"
import { clamp01 } from "@/infra/lib/math.ts"
import { COHERENCE } from "./constants.ts"
import type { CoherenceState, FragmentationSource } from "./types.ts"

interface CoherenceContext {
  emotion: EmotionalState
  soma: SomaticState
  driveState: DriveState
  dissonanceScore: number
  selfConceptAuthenticity: number
}

/**
 * Compute composite stress level from emotional and somatic indicators.
 */
function computeStressLevel(emotion: EmotionalState, soma: SomaticState): number {
  return (emotion.frustration + soma.tension + emotion.caution) / 3
}

/**
 * Detect fragmentation sources across subsystems.
 */
export function detectFragmentation(context: CoherenceContext): FragmentationSource[] {
  const sources: FragmentationSource[] = []

  if (context.soma.gravity > 0.7 && context.emotion.excitement > 0.7) {
    sources.push("emotion_soma_mismatch")
  }

  if (context.soma.tension > 0.7 && context.emotion.satisfaction > 0.6) {
    sources.push("emotion_soma_mismatch")
  }

  if (context.driveState.conflicting.length > 0) {
    sources.push("drive_conflict")
  }

  if (context.dissonanceScore > 0.5) {
    sources.push("value_action_gap")
  }

  if (context.emotion.frustration > 0.6 && context.emotion.confidence > 0.6) {
    sources.push("cognitive_emotional_split")
  }

  if (context.selfConceptAuthenticity < 0.4 && context.emotion.connection > 0.6) {
    sources.push("self_concept_behavior_gap")
  }

  return [...new Set(sources)]
}

/**
 * Compute overall coherence/integration score via target-based convergence.
 * Each fragmentation source lowers the equilibrium target; the score drifts toward it.
 */
export function computeCoherence(context: CoherenceContext, previous: CoherenceState): number {
  const sources = detectFragmentation(context)

  const compoundingBonus = COHERENCE.COMPOUNDING_PAIRS.reduce((bonus, [a, b]) => {
    if (sources.includes(a as FragmentationSource) && sources.includes(b as FragmentationSource)) {
      return bonus + COHERENCE.COMPOUNDING_BONUS_WEIGHT
    }
    return bonus
  }, 0)

  const target = clamp01(1 - sources.length * COHERENCE.FRAGMENTATION_WEIGHT - compoundingBonus)
  return clamp01(previous.integrationScore + (target - previous.integrationScore) * COHERENCE.CONVERGENCE_RATE)
}

/**
 * Determine if regression should occur.
 */
export function shouldRegress(integrationScore: number, stressLevel: number): boolean {
  return integrationScore < COHERENCE.REGRESSION_THRESHOLD && stressLevel > COHERENCE.REGRESSION_STRESS_THRESHOLD
}

/**
 * Compute coherence effects on communication and emotion.
 */
export function computeCoherenceEffect(state: CoherenceState): {
  communicationSimplification: number
  emotionalDamping: number
} {
  if (!state.regressionActive) {
    return { communicationSimplification: 0, emotionalDamping: 0 }
  }

  return {
    communicationSimplification: state.regressionDepth * COHERENCE.COMMUNICATION_SIMPLIFICATION,
    emotionalDamping: state.regressionDepth * COHERENCE.EMOTIONAL_DAMPING
  }
}

/**
 * Update full coherence state.
 */
export function updateCoherenceState(previous: CoherenceState, context: CoherenceContext): CoherenceState {
  const fragmentationSources = detectFragmentation(context)
  const integrationScore = computeCoherence(context, previous)
  const stressLevel = computeStressLevel(context.emotion, context.soma)
  const regressing = shouldRegress(integrationScore, stressLevel)

  let regressionDepth = previous.regressionDepth
  if (regressing) {
    regressionDepth = Math.min(1, regressionDepth + COHERENCE.REGRESSION_DEPTH_INCREMENT)
  } else if (previous.regressionActive) {
    regressionDepth = Math.max(0, regressionDepth - COHERENCE.CONVERGENCE_RATE)
  }

  return {
    integrationScore,
    fragmentationSources,
    regressionActive: regressing || (previous.regressionActive && regressionDepth > 0),
    regressionDepth
  }
}
