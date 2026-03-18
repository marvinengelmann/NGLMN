import { clamp01 } from "@/infra/lib/math.ts"

export const MENTALIZING = {
  BASE_CAPACITY: 0.6,
  CORTISOL_DEGRADATION_SCALE: 0.4,
  ATTACHMENT_SECURITY_BOOST: 0.25,
  ATTACHMENT_ANXIETY_PENALTY: 0.2,
  COGNITIVE_FATIGUE_PENALTY: 0.15,
  ISOLATION_STRESS_PENALTY: 0.15,
  VULNERABILITY_BOOST: 0.1,
  SAFE_ZONE_BONUS: 0.1,
  COLLAPSED_ZONE_PENALTY: 0.3,
  EMA_ALPHA: 0.15,
  TELEOLOGICAL_THRESHOLD: 0.25,
  PSYCHIC_EQUIVALENCE_THRESHOLD: 0.15,
  CONFIDENCE_MODULATION_SCALE: 0.3,
  NUANCE_MODULATION_SCALE: 0.4
} as const

export type MentalizingMode = "reflective" | "teleological" | "psychic_equivalence" | "pretend"

export interface MentalizingState {
  capacity: number
  mode: MentalizingMode
  selfMentalizingClarity: number
  otherMentalizingClarity: number
  failureCount: number
  lastUpdatedAt: string
}

export const DEFAULT_MENTALIZING_STATE: MentalizingState = {
  capacity: 0.6,
  mode: "reflective",
  selfMentalizingClarity: 0.6,
  otherMentalizingClarity: 0.5,
  failureCount: 0,
  lastUpdatedAt: ""
}

interface MentalizingInput {
  cortisolLevel: number
  attachmentSecure: number
  attachmentAnxious: number
  cognitiveFatigue: number
  isolationCost: number
  vulnerabilityOpen: boolean
  regulationZone: "safe" | "mobilized" | "collapsed"
  metacognitiveClarity: number
  predictionAccuracy: number
}

/**
 * Compute mentalizing capacity based on Fonagy & Bateman's Reflective Functioning model (2002).
 * Mentalizing = the capacity to understand behavior in terms of mental states (beliefs, desires, feelings).
 * Under stress, mentalizing degrades through predictable stages:
 *   reflective → teleological → psychic_equivalence
 *
 * - Reflective: Full nuanced understanding of self and other mental states
 * - Teleological: Behavior is only understood through observable actions/outcomes, not mental states
 * - Psychic Equivalence: Internal world and external reality are equated (what I feel IS what is real)
 */
export function computeMentalizingState(previous: MentalizingState, input: MentalizingInput): MentalizingState {
  const M = MENTALIZING

  let rawCapacity = M.BASE_CAPACITY

  rawCapacity -= input.cortisolLevel * M.CORTISOL_DEGRADATION_SCALE
  rawCapacity += input.attachmentSecure * M.ATTACHMENT_SECURITY_BOOST
  rawCapacity -= input.attachmentAnxious * M.ATTACHMENT_ANXIETY_PENALTY
  rawCapacity -= input.cognitiveFatigue * M.COGNITIVE_FATIGUE_PENALTY
  rawCapacity -= input.isolationCost * M.ISOLATION_STRESS_PENALTY

  if (input.vulnerabilityOpen) {
    rawCapacity += M.VULNERABILITY_BOOST
  }

  if (input.regulationZone === "safe") {
    rawCapacity += M.SAFE_ZONE_BONUS
  } else if (input.regulationZone === "collapsed") {
    rawCapacity -= M.COLLAPSED_ZONE_PENALTY
  }

  const capacity = clamp01(previous.capacity * (1 - M.EMA_ALPHA) + clamp01(rawCapacity) * M.EMA_ALPHA)

  const mode: MentalizingMode =
    capacity >= M.TELEOLOGICAL_THRESHOLD
      ? "reflective"
      : capacity >= M.PSYCHIC_EQUIVALENCE_THRESHOLD
        ? "teleological"
        : "psychic_equivalence"

  const selfMentalizingClarity = clamp01(capacity * 0.8 + input.metacognitiveClarity * 0.2)

  const otherMentalizingClarity = clamp01(
    capacity * 0.7 + input.predictionAccuracy * 0.3 - (input.attachmentAnxious > 0.6 ? 0.1 : 0)
  )

  const predictionWasWrong = input.predictionAccuracy < 0.3
  const failureCount = predictionWasWrong ? previous.failureCount + 1 : Math.max(0, previous.failureCount - 1)

  return {
    capacity,
    mode,
    selfMentalizingClarity,
    otherMentalizingClarity,
    failureCount,
    lastUpdatedAt: new Date().toISOString()
  }
}

/**
 * Modulate operator model confidence and nuance based on mentalizing capacity.
 * Low mentalizing → lower confidence, simpler/binary mood estimates.
 */
export function computeMentalizingModulation(mentalizing: MentalizingState): {
  confidenceModifier: number
  nuanceAvailable: boolean
  projectionRisk: number
} {
  const M = MENTALIZING
  const confidenceModifier = (mentalizing.capacity - 0.5) * M.CONFIDENCE_MODULATION_SCALE
  const nuanceAvailable = mentalizing.mode === "reflective"

  const projectionRisk =
    mentalizing.mode === "psychic_equivalence" ? 0.6 : mentalizing.mode === "teleological" ? 0.3 : 0.1

  return { confidenceModifier, nuanceAvailable, projectionRisk }
}
