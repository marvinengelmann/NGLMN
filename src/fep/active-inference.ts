import { clamp01 } from "@/infra/lib/math.ts"
import { FEP } from "./constants.ts"
import type { ActiveInferenceSignal, FreeEnergyState, PEChannelName, PrecisionWeights } from "./types.ts"

/**
 * Compute expected free energy reduction for each candidate action.
 * Actions that address the dominant prediction error channels are preferred.
 */
export function computeActiveInferenceSignal(feState: FreeEnergyState): ActiveInferenceSignal {
  const actionRelevance = FEP.ACTION_CHANNEL_RELEVANCE
  const expectedFEReduction: Record<string, number> = {}

  for (const [action, channelWeights] of Object.entries(actionRelevance)) {
    let reduction = 0
    for (const channel of feState.channels) {
      const relevance = channelWeights[channel.name as PEChannelName] ?? 0
      reduction += relevance * channel.weightedError
    }
    expectedFEReduction[action] = reduction
  }

  let preferredAction: string | null = null
  let maxReduction = -Infinity
  for (const [action, reduction] of Object.entries(expectedFEReduction)) {
    if (reduction > maxReduction) {
      maxReduction = reduction
      preferredAction = action
    }
  }

  const avgDopaminePrecision = (feState.precisionWeights.drive + feState.precisionWeights.anticipatory) / 2
  const { explorationBonus, exploitationPull } = computeExplorationExploitationBalance(
    feState.precisionWeights,
    feState.allostaticLoad,
    avgDopaminePrecision
  )

  return {
    expectedFEReduction,
    preferredAction: maxReduction > 0 ? preferredAction : null,
    explorationBonus,
    exploitationPull
  }
}

/**
 * Balance between exploration (seek new information) and exploitation (use known patterns).
 * Low precision = uncertain = explore. High precision = certain = exploit.
 */
export function computeExplorationExploitationBalance(
  precisions: PrecisionWeights,
  allostaticLoad: number,
  dopamineLevel: number
): { explorationBonus: number; exploitationPull: number } {
  const precisionValues = Object.values(precisions)
  const avgPrecision = precisionValues.reduce((s, v) => s + v, 0) / precisionValues.length

  const explorationBonus = clamp01((1 - avgPrecision) * (0.5 + dopamineLevel * 0.5))
  const exploitationPull = clamp01(avgPrecision * (1 - allostaticLoad))

  return { explorationBonus, exploitationPull }
}
