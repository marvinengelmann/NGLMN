export const COHERENCE = {
  REGRESSION_THRESHOLD: 0.25,
  REGRESSION_STRESS_THRESHOLD: 0.7,
  REGRESSION_DEPTH_INCREMENT: 0.1,
  COMMUNICATION_SIMPLIFICATION: 0.3,
  EMOTIONAL_DAMPING: 0.2,
  FRAGMENTATION_WEIGHT: 0.2,
  CONVERGENCE_RATE: 0.12,

  COMPOUNDING_PAIRS: [
    ["drive_conflict", "value_action_gap"],
    ["emotion_soma_mismatch", "cognitive_emotional_split"]
  ] as [string, string][],
  COMPOUNDING_BONUS_WEIGHT: 0.1
} as const
