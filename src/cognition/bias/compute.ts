import type { NeuromodulatoryState } from "@/affect/neuromodulation/types.ts"
import { clamp, clamp01 } from "@/infra/lib/math.ts"
import { nowISO } from "@/infra/lib/time.ts"
import { BIAS } from "./constants.ts"
import type { AnchorPoint, BiasState } from "./types.ts"

/**
 * Apply negativity bias — negative valences are amplified by ~2.5x (Kahneman's loss aversion).
 * Cortisol further amplifies the effect.
 */
export function applyNegativityBias(valence: number, biasStrength: number, cortisol: number): number {
  if (valence >= 0) return valence
  const amplification = BIAS.NEGATIVITY_WEIGHT * biasStrength * (1 + cortisol * BIAS.CORTISOL_NEGATIVITY_AMPLIFIER)
  return clamp(valence * amplification, -1, 0)
}

interface ScoredMemory {
  score: number
  timestamp: string
  valence?: number
}

/**
 * Apply availability bias — recent memories are overweighted in retrieval.
 * Returns new scores with recency boost applied.
 */
export function applyAvailabilityBias<T extends ScoredMemory>(memories: T[], biasStrength: number): T[] {
  const now = Date.now()
  const windowMs = BIAS.AVAILABILITY_RECENCY_HOURS * 60 * 60 * 1000

  return memories.map((memory) => {
    const age = now - new Date(memory.timestamp).getTime()
    if (age > windowMs) return memory

    const recencyFactor = 1 - age / windowMs
    const boost = BIAS.AVAILABILITY_BOOST * biasStrength * recencyFactor
    return { ...memory, score: memory.score + boost }
  })
}

interface Belief {
  key: string
  value: string
}

/**
 * Apply confirmation bias — memories that align with existing beliefs/self-concept
 * receive a score boost, contradicting memories receive a penalty.
 */
export function applyConfirmationBias<T extends ScoredMemory & { content?: string }>(
  memories: T[],
  beliefs: Belief[],
  biasStrength: number
): T[] {
  if (beliefs.length === 0) return memories

  const beliefKeywords = beliefs.flatMap((b) => [b.key.toLowerCase(), b.value.toLowerCase()])

  return memories.map((memory) => {
    const content = (memory.content ?? "").toLowerCase()
    const matchCount = beliefKeywords.filter((kw) => content.includes(kw)).length
    if (matchCount === 0) return memory

    const boost = BIAS.CONFIRMATION_BELIEF_BOOST * biasStrength * Math.min(matchCount, 3)
    return { ...memory, score: memory.score + boost }
  })
}

/**
 * Check if a topic has an existing anchor (first impression).
 * Returns the anchor influence strength, or 0 if no anchor exists.
 */
export function getAnchorInfluence(anchors: AnchorPoint[], topic: string): { anchored: boolean; influence: number } {
  const anchor = anchors.find((a) => a.topic === topic)
  if (!anchor) return { anchored: false, influence: 0 }
  return { anchored: true, influence: anchor.strength }
}

/**
 * Apply peak-end rule — evaluate a sequence of memory valences
 * by weighting peak + end rather than averaging.
 */
export function applyPeakEndRule(valences: number[]): number {
  if (valences.length === 0) return 0
  if (valences.length === 1) return valences[0] as number

  const peak = valences.reduce((max, v) => (Math.abs(v) > Math.abs(max) ? v : max), 0)
  const end = valences[valences.length - 1] as number
  const average = valences.reduce((sum, v) => sum + v, 0) / valences.length

  return (BIAS.PEAK_END_WEIGHT * (peak + end)) / 2 + (1 - BIAS.PEAK_END_WEIGHT) * average
}

/**
 * Compute mere exposure effect — familiarity breeds preference.
 * Returns a preference boost based on exposure count.
 */
export function computeMereExposureEffect(entityName: string, exposureCounts: Record<string, number>): number {
  const count = exposureCounts[entityName] ?? 0
  if (count < BIAS.MERE_EXPOSURE_THRESHOLD) return 0

  const excess = count - BIAS.MERE_EXPOSURE_THRESHOLD
  return Math.min(BIAS.MERE_EXPOSURE_MAX, excess * BIAS.MERE_EXPOSURE_BOOST)
}

/**
 * Apply optimism bias — negative future predictions are shifted toward neutral.
 * Low serotonin reduces this protective bias.
 */
export function applyOptimismBias(prediction: number, biasStrength: number, serotonin: number): number {
  if (prediction >= 0) return prediction

  const serotoninFactor = 1 - (1 - serotonin) * BIAS.SEROTONIN_OPTIMISM_LINK
  const shift = BIAS.OPTIMISM_BIAS_SCALE * biasStrength * serotoninFactor
  return clamp(prediction * (1 - shift), -1, 1)
}

/**
 * Update bias modifier strengths based on neuromodulatory state.
 * Cortisol amplifies negativity bias, low serotonin weakens optimism bias, dopamine boosts confirmation bias.
 */
export function updateBiasModifiers(biasState: BiasState, neuro: NeuromodulatoryState): BiasState {
  const modifiers = { ...biasState.activeModifiers }

  modifiers.negativity = clamp01(0.4 + neuro.cortisol.level * BIAS.CORTISOL_NEGATIVITY_AMPLIFIER)
  modifiers.optimism = clamp01(0.4 + neuro.serotonin.level * BIAS.SEROTONIN_OPTIMISM_LINK)
  modifiers.confirmation = clamp01(0.3 + neuro.dopamine.level * BIAS.DOPAMINE_CONFIRMATION_LINK)

  return {
    ...biasState,
    activeModifiers: modifiers,
    lastUpdatedAt: nowISO()
  }
}

/**
 * Decay anchoring points — first impressions weaken slowly over time.
 */
export function decayAnchors(anchors: AnchorPoint[], daysSinceUpdate: number): AnchorPoint[] {
  return anchors
    .map((anchor) => ({
      ...anchor,
      strength: anchor.strength * BIAS.ANCHORING_DECAY_RATE ** daysSinceUpdate
    }))
    .filter((anchor) => anchor.strength > 0.05)
}

/**
 * Add a new anchor point if the topic doesn't already have one.
 */
export function addAnchor(anchors: AnchorPoint[], topic: string, firstImpression: string): AnchorPoint[] {
  if (anchors.some((a) => a.topic === topic)) return anchors

  const updated = [
    ...anchors,
    {
      topic,
      firstImpression,
      anchoredAt: nowISO(),
      strength: 1.0
    }
  ]

  if (updated.length > BIAS.ANCHORING_MAX_POINTS) {
    updated.sort((a, b) => b.strength - a.strength)
    return updated.slice(0, BIAS.ANCHORING_MAX_POINTS)
  }

  return updated
}

/**
 * Increment exposure count for an entity.
 */
export function incrementExposure(exposureCounts: Record<string, number>, entityName: string): Record<string, number> {
  return {
    ...exposureCounts,
    [entityName]: (exposureCounts[entityName] ?? 0) + 1
  }
}
