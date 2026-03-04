export const BUDGET = {
  DAILY_LIMIT: 5.0,
  LOW_BUDGET_THRESHOLD: 0.1
} as const

export const CONTEXT_TOKEN_BUDGET = 2_000_000
export const MAX_OUTPUT_TOKENS = 30_000

export const HEARTBEAT = {
  CRON: "* * * * *",
  CONCURRENCY: 10,
  BUSY_TTL: 900,
  CONVERSATION_POLL_TIMEOUT: 60,
  MAX_CONVERSATION_WAIT: 300
} as const

export const CONTEXT_LIMITS = {
  maxGoals: 10,
  maxEpisodes: 15,
  maxSemantic: 20,
  maxRelationship: 10,
  maxEmotionHistory: 10
} as const

export const HEALTH_CHECK_INTERVAL = 900

export const EMOTION = {
  HALF_LIVES: {
    curiosity: 60,
    satisfaction: 240,
    frustration: 120,
    boredom: 90,
    excitement: 30,
    caution: 360,
    connection: 720,
    confidence: 480,
    energy: 360
  },
  MAX_DELTA: 0.2,
  NOVELTY_SCALE: 0.25,
  NOVELTY_MAX_MULTIPLIER: 2.5
} as const

export const MOOD_BASELINE = {
  SILENCE_HOURS_FULL_EFFECT: 48,
  SILENCE_CONNECTION_DROP: 0.2,
  SILENCE_BOREDOM_RISE: 0.15,
  CONVERSATION_CONNECTION_BOOST: 0.15,
  CONVERSATION_EXCITEMENT_BOOST: 0.1,
  CONVERSATION_BOREDOM_DROP: 0.2,
  HEALTHY_SATISFACTION_BOOST: 0.05,
  GOALS_CURIOSITY_BOOST: 0.05,
  GOALS_BOREDOM_DROP: 0.05,
  DREAMING_ENERGY_TARGET: 0.9,
  WAKING_ENERGY_TARGET: 0.15
} as const

export const TYPING = {
  WORDS_PER_MINUTE: 50,
  BASE_THINKING_MS: 300,
  JITTER_FACTOR: 0.25,
  MIN_MS: 1500,
  MAX_MS: 20000,
  REFRESH_MS: 5000
} as const

export const CONVERSATION = {
  GAP_MINUTES: 30,
  MAX_ROUNDS: 10,
  MAX_BUFFER_SLOTS: 3
} as const

export const GUARDIAN = {
  MIN_RESPONSE_LENGTH: 1,
  MAX_RESPONSE_LENGTH: 4000,
  STUCK_LOOP_COUNT: 3,
  REPEAT_CHECK_COUNT: 5
} as const

export const WORKFLOW = {
  MAX_ACTIVE: 10,
  MIN_EXECUTION_GAP_HOURS: 1
} as const

export const TRUST = {
  BASE_THRESHOLD: 0.3,
  RISK_LEVELS: {
    add_goal: 0.3,
    git_commit: 0.5,
    prompt_modification: 0.6,
    workflow_creation: 0.7,
    deployment: 0.8,
    code_modification: 0.9
  }
} as const

export const EMOTIONAL_THRESHOLDS = {
  CONNECTION_HIGH: 0.6,
  RELEVANCE_INTERACTION: 0.8,
  RELEVANCE_DEFAULT: 0.7,
  RELEVANCE_RELATIONSHIP: 0.85,
  RELEVANCE_OBSERVATION: 0.7
} as const

export const TRIGGER_INTENSITY = {
  MESSAGE_SENT: 0.7,
  MESSAGE_RECEIVED: 0.6,
  TASK_SUCCESS: 0.5,
  TASK_FAILURE: 0.6,
  GUARDIAN_WARNING: 0.6,
  GUARDIAN_BLOCK: 0.8,
  NEW_GOAL: 0.5,
  GOAL_COMPLETED: 0.7,
  GOAL_FAILED: 0.6
} as const

export const THINKING = {
  INTER_PARAGRAPH_MIN_MS: 800,
  INTER_PARAGRAPH_MAX_MS: 2500,
  MIN_SPLIT_LENGTH: 200
} as const

export const MESSAGE_DELAY = {
  MIN_BETWEEN_MESSAGES_MS: 500,
  MAX_JITTER_MS: 1500
} as const

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

export const REFLECTION = {
  COOLDOWN_HOURS: 6,
  INTENSITY_THRESHOLD: 0.45,
  DRIVE_MODIFIER: 0.1,
  DISSONANCE_THRESHOLD: 0.8
} as const
