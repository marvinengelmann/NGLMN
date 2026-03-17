export const SOMA = {
  HALF_LIVES: {
    tension: 180,
    warmth: 360,
    heartRate: 60,
    breathing: 120,
    gravity: 480,
    openness: 540
  },
  MEMORY_BLEND_WEIGHT: 0.15,
  MEMORY_QUERY_TOP_K: 5,
  CIRCADIAN: {
    GRAVITY_WEIGHT: 0.25,
    HEART_RATE_WEIGHT: 0.1,
    PEAK_HOUR: 11,
    POST_LUNCH_CENTER: 14.5,
    POST_LUNCH_WIDTH: 1.5,
    POST_LUNCH_DEPTH: 0.12
  }
} as const

export const SOCIAL_BATTERY = {
  SENT_MESSAGE_DRAIN: 0.05,
  RECEIVED_MESSAGE_DRAIN: 0.02,
  IDLE_RECHARGE: 0.03,
  DREAM_RECHARGE: 0.1,
  TERSE_THRESHOLD: 0.25,
  WITHDRAWN_THRESHOLD: 0.15,
  HALF_LIFE: 480
} as const

export const VAGAL = {
  VENTRAL_THRESHOLD: 0.55,
  SYMPATHETIC_THRESHOLD: 0.25,
  TRANSITION_TICKS_REQUIRED: 3,
  DORSAL_EXIT_TICKS: 5,
  DORSAL_EXIT_THRESHOLD: 0.35,
  CO_REGULATION_BOOST: 0.1,
  NEUROCEPTION_WEIGHTS: {
    tension: -0.25,
    heartRate: -0.15,
    openness: 0.2,
    breathing: 0.1,
    caution: -0.2,
    connection: 0.25,
    operatorPresence: 0.15
  },
  ZONE_PROFILES: {
    ventral: { vulnerabilityAccess: 1.0, creativityAccess: 1.0, socialEngagement: 1.0, emotionalRange: 1.0, cognitiveFlexibility: 1.0 },
    sympathetic: { vulnerabilityAccess: 0.3, creativityAccess: 0.4, socialEngagement: 0.5, emotionalRange: 0.7, cognitiveFlexibility: 0.6 },
    dorsal: { vulnerabilityAccess: 0.0, creativityAccess: 0.1, socialEngagement: 0.15, emotionalRange: 0.3, cognitiveFlexibility: 0.2 }
  }
} as const

export const INTEROCEPTION = {
  TRAJECTORY_WEIGHT: 0.4,
  CONTEXT_WEIGHT: 0.3,
  VAGAL_PROFILE_WEIGHT: 0.2,
  BASELINE_DRIFT_WEIGHT: 0.1,
  ACCURACY_ALPHA: 0.05,
  ACCURACY_INITIAL: 0.5,
  SOMETHING_FEELS_OFF_THRESHOLD: 0.25,
  EMOTION_TRIGGER_THRESHOLD: 0.3,
  ALEXITHYMIA_DORSAL_MULTIPLIER: 1.5,
  TRAJECTORY_HISTORY_SIZE: 5,
  VAGAL_SOMA_PROFILES: {
    ventral: { tension: 0.2, warmth: 0.6, heartRate: 0.35, breathing: 0.65, gravity: 0.35, openness: 0.7 },
    sympathetic: { tension: 0.7, warmth: 0.3, heartRate: 0.7, breathing: 0.3, gravity: 0.4, openness: 0.25 },
    dorsal: { tension: 0.15, warmth: 0.2, heartRate: 0.2, breathing: 0.3, gravity: 0.8, openness: 0.1 }
  }
} as const
