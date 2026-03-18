import { clamp } from "@/infra/lib/math.ts"
import { FEP } from "./constants.ts"
import {
  PE_CHANNEL_HIERARCHY,
  type PEHierarchyLevel,
  type PrecisionWeights,
  type PredictionErrorChannel
} from "./types.ts"

/**
 * Compute top-down precision modulation from hierarchical predictive processing.
 * Higher levels (narrative, social) provide contextual priors that modulate
 * precision at lower levels (affective, interoceptive).
 */
/**
 * Apply bidirectional hierarchical precision modulation.
 * Top-down: higher-level PE increases lower-level precision (contextual priors).
 * Bottom-up: lower-level PE increases higher-level precision (body signals demand processing).
 */
export function applyHierarchicalPrecisionModulation(
  channels: PredictionErrorChannel[],
  precisionWeights: PrecisionWeights
): PrecisionWeights {
  const levelErrors = computeLevelAverageErrors(channels)
  const topDownMod = computeTopDownModulation(levelErrors)
  const bottomUpMod = computeBottomUpModulation(levelErrors)

  const modulated = { ...precisionWeights }

  for (const channel of channels) {
    const channelLevel = PE_CHANNEL_HIERARCHY[channel.name]
    const combinedMod = (topDownMod[channelLevel] ?? 0) + (bottomUpMod[channelLevel] ?? 0)

    const key = channel.name as keyof PrecisionWeights
    modulated[key] = clamp(modulated[key] * (1 + combinedMod), FEP.PRECISION_FLOOR, FEP.PRECISION_CEILING)
  }

  return modulated
}

function computeLevelAverageErrors(channels: PredictionErrorChannel[]): Record<PEHierarchyLevel, number> {
  const sums: Record<PEHierarchyLevel, number> = { interoceptive: 0, affective: 0, social: 0, narrative: 0 }
  const counts: Record<PEHierarchyLevel, number> = { interoceptive: 0, affective: 0, social: 0, narrative: 0 }

  for (const channel of channels) {
    const level = PE_CHANNEL_HIERARCHY[channel.name]
    sums[level] += channel.weightedError
    counts[level]++
  }

  return {
    interoceptive: counts.interoceptive > 0 ? sums.interoceptive / counts.interoceptive : 0,
    affective: counts.affective > 0 ? sums.affective / counts.affective : 0,
    social: counts.social > 0 ? sums.social / counts.social : 0,
    narrative: counts.narrative > 0 ? sums.narrative / counts.narrative : 0
  }
}

/**
 * Compute bottom-up modulation: lower-level PE boosts precision at higher levels.
 * Body signals (interoceptive) demand emotional processing (affective),
 * emotional distress demands relational attention (social),
 * relational issues demand identity work (narrative).
 */
function computeBottomUpModulation(levelErrors: Record<PEHierarchyLevel, number>): Record<PEHierarchyLevel, number> {
  const H = FEP.HIERARCHY
  const W = H.BOTTOM_UP_WEIGHT

  const interoceptiveError = levelErrors.interoceptive
  const affectiveError = levelErrors.affective
  const socialError = levelErrors.social

  return {
    interoceptive: 0,
    affective: interoceptiveError * H.INTEROCEPTIVE_TO_AFFECTIVE * W,
    social: (interoceptiveError * H.INTEROCEPTIVE_TO_AFFECTIVE + affectiveError * H.AFFECTIVE_TO_SOCIAL) * W,
    narrative:
      (interoceptiveError * H.INTEROCEPTIVE_TO_AFFECTIVE +
        affectiveError * H.AFFECTIVE_TO_SOCIAL +
        socialError * H.SOCIAL_TO_NARRATIVE) *
      W
  }
}

/**
 * Compute top-down modulation factors for each hierarchy level.
 * High PE at a higher level increases precision (attention) at lower levels,
 * because unresolved higher-order predictions demand more precise lower-level data.
 */
function computeTopDownModulation(levelErrors: Record<PEHierarchyLevel, number>): Record<PEHierarchyLevel, number> {
  const H = FEP.HIERARCHY
  const W = H.TOP_DOWN_WEIGHT

  const narrativeError = levelErrors.narrative
  const socialError = levelErrors.social
  const affectiveError = levelErrors.affective

  return {
    narrative: 0,
    social: narrativeError * H.NARRATIVE_TO_SOCIAL * W,
    affective: (narrativeError * H.NARRATIVE_TO_SOCIAL + socialError * H.SOCIAL_TO_AFFECTIVE) * W,
    interoceptive:
      (narrativeError * H.NARRATIVE_TO_SOCIAL +
        socialError * H.SOCIAL_TO_AFFECTIVE +
        affectiveError * H.AFFECTIVE_TO_INTEROCEPTIVE) *
      W
  }
}
