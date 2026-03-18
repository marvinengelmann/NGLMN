import type { PEChannelName } from "./types.ts"

export const FEP = {
  ALLOSTATIC_LOAD_ALPHA: 0.03,

  COMPLEXITY_WEIGHTS: {
    COHERENCE: 0.3,
    DISSONANCE: 0.3,
    DEFENSE: 0.2,
    FORECAST_MISCALIBRATION: 0.2
  },

  MAX_DEFENSE_COUNT: 8,

  HISTORY_LENGTH: 20,

  TREND_WINDOW: 5,

  VAGAL_PRECISION_GAIN: {
    ventral: 1.0,
    sympathetic: 0.7,
    dorsal: 0.4
  } as Record<string, number>,

  NEURO_PRECISION: {
    NOREPINEPHRINE_SCALE: 0.6,
    NOREPINEPHRINE_BASE: 0.7,
    DOPAMINE_SCALE: 0.4,
    DOPAMINE_BASE: 0.8,
    CORTISOL_THREAT_SCALE: 0.3,
    CORTISOL_THREAT_BASE: 0.9,
    CORTISOL_SOCIAL_SCALE: 0.3,
    CORTISOL_SOCIAL_BASE: 1.1,
    SEROTONIN_VOLATILITY_THRESHOLD: 0.3,
    OXYTOCIN_SCALE: 0.3,
    OXYTOCIN_BASE: 0.9,
    ENDORPHIN_SCALE: 0.3,
    ENDORPHIN_BASE: 1.1
  },

  PRECISION_FLOOR: 0.05,
  PRECISION_CEILING: 1.0,

  ACTION_CHANNEL_RELEVANCE: {
    respond: {
      anticipatory: 0.8,
      relational: 0.7,
      drive: 0.5,
      novelty: 0.3,
      dissonance: 0.2,
      interoceptive: 0.1,
      coherence: 0.1,
      forecast: 0.1,
      metacognitive: 0.1
    },
    idle: {
      interoceptive: 0.2,
      anticipatory: -0.3,
      novelty: 0.0,
      relational: -0.2,
      coherence: 0.1,
      dissonance: 0.0,
      drive: -0.1,
      forecast: 0.0,
      metacognitive: 0.1
    },
    reflect: {
      metacognitive: 0.8,
      coherence: 0.7,
      dissonance: 0.6,
      interoceptive: 0.3,
      forecast: 0.3,
      anticipatory: 0.1,
      novelty: 0.1,
      relational: 0.1,
      drive: 0.2
    },
    dream: {
      metacognitive: 0.6,
      forecast: 0.5,
      coherence: 0.4,
      interoceptive: 0.3,
      dissonance: 0.3,
      anticipatory: 0.0,
      novelty: 0.2,
      relational: 0.1,
      drive: 0.2
    },
    social_media: {
      novelty: 0.7,
      drive: 0.6,
      anticipatory: 0.2,
      relational: 0.1,
      interoceptive: 0.0,
      coherence: 0.0,
      dissonance: 0.0,
      forecast: 0.0,
      metacognitive: 0.1
    },
    morning: {
      metacognitive: 0.5,
      coherence: 0.4,
      interoceptive: 0.3,
      drive: 0.3,
      anticipatory: 0.2,
      novelty: 0.1,
      relational: 0.1,
      dissonance: 0.1,
      forecast: 0.2
    }
  } as Record<string, Record<PEChannelName, number>>,

  VOLATILITY: {
    MIN_HISTORY: 3,
    MAX_COEFFICIENT: 1.0
  },

  LEARNING_RATE: {
    VOLATILITY_SCALE: 1.0,
    VOLATILITY_BASE: 0.5,
    LOAD_PENALTY: 0.3,
    DOPAMINE_SCALE: 0.4,
    MIN: 0.3,
    MAX: 1.5
  },

  EMOTION_MODULATION: {
    HIGH_FE_THRESHOLD: 0.7,
    HIGH_FE_CAUTION: 0.05,
    HIGH_FE_ENERGY_DRAIN: 0.03,
    HIGH_LOAD_THRESHOLD: 0.6,
    HIGH_LOAD_SATISFACTION_DRAIN: 0.04,
    HIGH_LOAD_ENERGY_DRAIN: 0.05,
    LOW_FE_THRESHOLD: 0.2,
    LOW_FE_SATISFACTION: 0.03,
    LOW_FE_CONFIDENCE: 0.02
  },

  ALLOSTATIC_CORTISOL_SCALE: 0.15
} as const
