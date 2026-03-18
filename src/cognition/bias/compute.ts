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
 * Apply calibration bias — confidence is inflated at low familiarity
 * and monotonically decreases toward accurate calibration as experience grows.
 */
export function applyCalibrationBias(confidence: number, domainFamiliarity: number, biasStrength: number): number {
  if (biasStrength <= 0) return confidence

  const boost = Math.max(0, (1 - domainFamiliarity) * BIAS.CALIBRATION_OVERCONFIDENCE_SCALE * biasStrength)
  return clamp01(confidence + boost)
}

/**
 * Apply Spotlight Effect — overestimate how much the operator notices
 * internal state changes. Returns an amplified perceived-observability score.
 * Higher under stress (cortisol), modulated by social bonding (oxytocin).
 */
export function applySpotlightEffect(
  stateChangeMagnitude: number,
  biasStrength: number,
  selfAwareness: number
): number {
  if (biasStrength <= 0 || stateChangeMagnitude <= 0) return stateChangeMagnitude

  const floor = BIAS.SPOTLIGHT_SELF_AWARENESS_FLOOR
  const amplification = BIAS.SPOTLIGHT_AMPLIFICATION
  const awarenessScale = Math.max(floor, selfAwareness)
  return clamp01(stateChangeMagnitude * (1 + (amplification - 1) * biasStrength * awarenessScale))
}

/**
 * Update bias modifier strengths based on neuromodulatory state.
 * Cortisol amplifies negativity bias, low serotonin weakens optimism bias, dopamine boosts confirmation bias.
 * Dopamine amplifies calibration bias, cortisol and oxytocin amplify Spotlight Effect.
 */
export function updateBiasModifiers(biasState: BiasState, neuro: NeuromodulatoryState): BiasState {
  const modifiers = { ...biasState.activeModifiers }

  modifiers.negativity = clamp01(0.4 + neuro.cortisol.level * BIAS.CORTISOL_NEGATIVITY_AMPLIFIER)
  modifiers.optimism = clamp01(0.4 + neuro.serotonin.level * BIAS.SEROTONIN_OPTIMISM_LINK)
  modifiers.confirmation = clamp01(0.3 + neuro.dopamine.level * BIAS.DOPAMINE_CONFIRMATION_LINK)
  modifiers.calibration_bias = clamp01(0.3 + neuro.dopamine.level * BIAS.CALIBRATION_BIAS_DOPAMINE_LINK)
  modifiers.spotlight = clamp01(
    0.2 + neuro.cortisol.level * BIAS.SPOTLIGHT_CORTISOL_LINK + neuro.oxytocin.level * BIAS.SPOTLIGHT_OXYTOCIN_LINK
  )
  modifiers.fundamental_attribution = clamp01(0.3 + neuro.cortisol.level * 0.2)
  modifiers.false_consensus = clamp01(0.2 + neuro.oxytocin.level * 0.3)
  modifiers.projection = clamp01(0.2 + neuro.dopamine.level * 0.15 + neuro.cortisol.level * 0.15)

  return {
    ...biasState,
    activeModifiers: modifiers,
    lastUpdatedAt: nowISO()
  }
}

/**
 * Decay anchoring points with biphasic model:
 * Phase 1 (first 24h): rapid strength establishment (0.95 decay).
 * Phase 2 (after 24h): slow long-term decay (0.995 decay).
 */
export function decayAnchors(anchors: AnchorPoint[], daysSinceUpdate: number): AnchorPoint[] {
  const now = Date.now()
  return anchors
    .map((anchor) => {
      const ageHours = (now - new Date(anchor.anchoredAt).getTime()) / (1000 * 60 * 60)
      const decayRate =
        ageHours < BIAS.ANCHORING_RAPID_PHASE_HOURS ? BIAS.ANCHORING_RAPID_DECAY_RATE : BIAS.ANCHORING_SLOW_DECAY_RATE
      return { ...anchor, strength: anchor.strength * decayRate ** daysSinceUpdate }
    })
    .filter((anchor) => anchor.strength > 0.05)
}

/**
 * Fundamental Attribution Error — tendency to attribute operator behavior
 * to personality/disposition rather than situational factors.
 * Modulated by agreeableness (higher agreeableness = more charitable interpretation).
 */
export function applyFundamentalAttributionError(
  operatorMood: string,
  biasStrength: number,
  agreeableness: number
): { attributionType: "dispositional" | "situational"; intensity: number } {
  if (biasStrength <= 0) return { attributionType: "situational", intensity: 0 }

  const damping = agreeableness * BIAS.FUNDAMENTAL_ATTRIBUTION_AGREEABLENESS_DAMPING
  const effectiveStrength = biasStrength * (1 - damping)

  const negativeMoods = ["stressed", "frustrated", "sad", "tired"]
  const isNegative = negativeMoods.includes(operatorMood)

  if (!isNegative) return { attributionType: "situational", intensity: 0 }

  return {
    attributionType: effectiveStrength > 0.3 ? "dispositional" : "situational",
    intensity: clamp01(effectiveStrength)
  }
}

/**
 * False Consensus Effect — project own emotional state onto predictions of operator's state.
 * Stronger when connection is high, weaker when metacognitive clarity is high.
 */
export function applyFalseConsensus(
  currentEmotion: Record<string, number>,
  connectionLevel: number,
  metacognitiveClarity: number,
  biasStrength: number
): Record<string, number> {
  if (biasStrength <= 0) return {}

  const connectionBoost = connectionLevel * BIAS.FALSE_CONSENSUS_CONNECTION_SCALE
  const metacognitionReduction = metacognitiveClarity * BIAS.FALSE_CONSENSUS_METACOGNITION_REDUCTION
  const effectiveStrength = clamp01(biasStrength + connectionBoost - metacognitionReduction)

  const projectedDeltas: Record<string, number> = {}
  for (const [dim, value] of Object.entries(currentEmotion)) {
    const deviation = value - 0.5
    if (Math.abs(deviation) > 0.1) {
      projectedDeltas[dim] = deviation * effectiveStrength * 0.3
    }
  }
  return projectedDeltas
}

/**
 * Projection Bias — current emotional state colors prediction of future states.
 * People in a positive mood predict future positivity; negative mood predicts future negativity.
 */
export function applyProjectionBias(
  currentEmotion: Record<string, number>,
  biasStrength: number
): Record<string, number> {
  if (biasStrength <= 0) return {}

  const projectedShifts: Record<string, number> = {}
  for (const [dim, value] of Object.entries(currentEmotion)) {
    const deviation = value - 0.5
    if (Math.abs(deviation) > 0.15) {
      projectedShifts[dim] = deviation * BIAS.PROJECTION_INTENSITY_SCALE * biasStrength
    }
  }
  return projectedShifts
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
