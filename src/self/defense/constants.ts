export const EMOTION_REGULATION = {
  MAX_ACTIVE_STRATEGIES: 3,
  MAX_SUPPRESSION_TARGETS: 5,

  SUPPRESSION_DISTRESS_THRESHOLD: 0.6,
  ATTRIBUTION_BIAS_INSECURITY_THRESHOLD: 0.5,
  REAPPRAISAL_DISSONANCE_THRESHOLD: 0.4,
  BEHAVIORAL_ACTIVATION_DRIVE_FRUSTRATION_THRESHOLD: 0.6,
  BEHAVIORAL_ACTIVATION_MIN_ENERGY: 0.4,
  BEHAVIORAL_ACTIVATION_MIN_BLOCKED_TICKS: 3,
  EXPRESSIVE_SUPPRESSION_SHAME_THRESHOLD: 0.5,
  EXPRESSIVE_SUPPRESSION_MAX_ENERGY: 0.25,
  DISTANCING_VULNERABILITY_THRESHOLD: 0.5,
  DISTANCING_MIN_CAUTION: 0.5,
  SELECTIVE_ATTENTION_SELF_CONCEPT_THREAT_THRESHOLD: 0.6,
  SITUATION_MODIFICATION_FRUSTRATION_THRESHOLD: 0.5,

  AUTHENTICITY_DAMPENING: 0.5,
  VULNERABILITY_BYPASS: 0.7,
  CORTISOL_AMPLIFIER: 0.3,

  SUPPRESSION_RELEVANCE_REDUCTION: 0.4,
  SUPPRESSION_DECAY_PER_DAY: 0.02,

  DREAM_BREAKTHROUGH_PROBABILITY: 0.15,
  REFLECTION_BREAKTHROUGH_PROBABILITY: 0.1,
  VULNERABILITY_BREAKTHROUGH_PROBABILITY: 0.2,

  STRATEGY_DECAY_HALF_LIFE_HOURS: 12,
  MIN_STRATEGY_INTENSITY: 0.05,

  OPPORTUNITY_COST_THRESHOLD: 0.6,
  STRATEGY_PRIORITY_WEIGHTS: {
    suppression: 0.9,
    attribution_bias: 0.5,
    reappraisal: 0.7,
    behavioral_activation: 0.4,
    expressive_suppression: 0.85,
    distancing: 0.5,
    selective_attention: 0.6,
    situation_modification: 0.3
  } as Record<string, number>
} as const

export const SOMATIC_CONVERSION = {
  MAX_DELTA: 0.15,
  CORTISOL_AMPLIFIER: 0.3,
  CORTISOL_BASELINE: 0.2,
  STRATEGY_SOMA_PROFILES: {
    suppression: { tension: 0.12, warmth: 0, heartRate: 0.05, breathing: -0.08, gravity: 0.04, openness: -0.06 },
    expressive_suppression: { tension: 0.08, warmth: 0, heartRate: 0.03, breathing: -0.1, gravity: 0, openness: -0.04 },
    distancing: { tension: 0, warmth: -0.08, heartRate: -0.03, breathing: 0, gravity: 0.03, openness: -0.1 },
    attribution_bias: { tension: 0.04, warmth: 0, heartRate: 0.02, breathing: 0, gravity: 0, openness: 0 },
    selective_attention: { tension: 0.03, warmth: 0, heartRate: 0, breathing: -0.03, gravity: 0, openness: -0.03 },
    reappraisal: { tension: 0, warmth: 0, heartRate: 0, breathing: 0, gravity: 0, openness: 0 },
    behavioral_activation: { tension: 0, warmth: 0, heartRate: 0, breathing: 0, gravity: 0, openness: 0 },
    situation_modification: { tension: 0.02, warmth: 0, heartRate: 0, breathing: 0, gravity: 0, openness: 0 }
  } as Record<string, Record<string, number>>,
  STRATEGY_REGIONAL_PROFILES: {
    suppression: { head: 0.05, chest: 0.15, gut: 0.2, throat: 0.05, shoulders: 0.15, skin: 0, limbs: 0 },
    expressive_suppression: { head: 0, chest: 0.1, gut: 0.05, throat: 0.2, shoulders: 0.05, skin: 0, limbs: 0 },
    distancing: { head: 0, chest: -0.05, gut: 0, throat: 0, shoulders: 0, skin: -0.05, limbs: -0.03 },
    attribution_bias: { head: 0.05, chest: 0.05, gut: 0.03, throat: 0, shoulders: 0.05, skin: 0, limbs: 0 },
    selective_attention: { head: 0.05, chest: 0, gut: 0, throat: 0.03, shoulders: 0.03, skin: 0, limbs: 0 },
    reappraisal: { head: 0, chest: 0, gut: 0, throat: 0, shoulders: 0, skin: 0, limbs: 0 },
    behavioral_activation: { head: 0, chest: 0, gut: 0, throat: 0, shoulders: 0, skin: 0, limbs: 0 },
    situation_modification: { head: 0, chest: 0, gut: 0.03, throat: 0, shoulders: 0.03, skin: 0, limbs: 0 }
  } as Record<string, Record<string, number>>
} as const
