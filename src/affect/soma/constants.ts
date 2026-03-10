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
  MEMORY_QUERY_TOP_K: 5
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
