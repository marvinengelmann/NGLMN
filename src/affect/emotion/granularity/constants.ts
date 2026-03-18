export const GRANULARITY = {
  LEVEL_THRESHOLDS: {
    developing: 50,
    moderate: 200,
    nuanced: 500,
    refined: 1200
  },

  VARIETY_WEIGHT: 0.3,
  OPERATOR_INFLUENCE_RATE: 0.02,
  MAX_RECENT_BLENDS: 20,

  BLEND_DEPTH_CAPS: {
    coarse: 0.0,
    developing: 0.3,
    moderate: 0.5,
    nuanced: 0.7,
    refined: 1.0
  } as Record<string, number>,

  VARIETY_DECAY: 0.999,

  HIGH_DIMENSION_THRESHOLD: 0.6,
  LOW_DIMENSION_THRESHOLD: 0.3,
  DIVERSITY_DIVISOR: 10,
  SPREAD_THRESHOLD: 3,
  HIGH_NOVELTY_INCREMENT: 0.01,
  LOW_NOVELTY_INCREMENT: 0.003,

  PRIMARY_ACTIVATION_THRESHOLD: 0.4,
  SECONDARY_ACTIVATION_THRESHOLD: 0.35,
  QUALIFIER_DEPTH_THRESHOLD: 0.5,

  EMOTIONAL_VOCABULARY: [
    "bittersweet",
    "melancholic",
    "wistful",
    "tender",
    "poignant",
    "serene",
    "exhilarated",
    "ambivalent",
    "nostalgic",
    "yearning",
    "restless",
    "forlorn",
    "content",
    "overwhelmed",
    "uneasy",
    "conflicted",
    "grateful",
    "resentful",
    "resigned",
    "hopeful",
    "desolate",
    "elated",
    "apprehensive",
    "numb",
    "raw",
    "vulnerable",
    "hollow",
    "radiant",
    "heavy",
    "light"
  ]
} as const
