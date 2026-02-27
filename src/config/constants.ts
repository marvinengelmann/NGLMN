import type { TriageDecision } from "@/core/types.ts"

export type TierKey = TriageDecision | "triage"

export const BUDGET = {
  DAILY_LIMIT: 8.0,
  LOW_BUDGET_THRESHOLD: 0.1
} as const

export const TIERS = {
  triage: { maxGoals: 3, maxEpisodes: 0, maxSemantic: 0, maxRelationship: 0, maxEmotionHistory: 0 },
  idle: { maxGoals: 0, maxEpisodes: 0, maxSemantic: 0, maxRelationship: 0, maxEmotionHistory: 0 },
  simple: { maxGoals: 0, maxEpisodes: 3, maxSemantic: 0, maxRelationship: 0, maxEmotionHistory: 0 },
  complex: { maxGoals: 10, maxEpisodes: 10, maxSemantic: 15, maxRelationship: 5, maxEmotionHistory: 0 },
  deep: { maxGoals: 10, maxEpisodes: 15, maxSemantic: 20, maxRelationship: 10, maxEmotionHistory: 10 }
} as const satisfies Record<TierKey, Record<string, number>>

export const TOKEN_BUDGETS: Record<TierKey, number> = {
  triage: 3000,
  idle: 3000,
  simple: 6000,
  complex: 15000,
  deep: 30000
}

export const MAX_TOKENS: Record<TierKey, number> = {
  triage: 256,
  idle: 256,
  simple: 512,
  complex: 2048,
  deep: 4096
}

export const EMOTION = {
  DECAY_RATE: 0.05,
  MAX_DELTA: 0.15
} as const

export const TYPING = {
  WORDS_PER_MINUTE: 180,
  BASE_THINKING_MS: 800,
  JITTER_FACTOR: 0.2,
  MIN_MS: 1500,
  MAX_MS: 15000,
  REFRESH_MS: 5000
} as const

export const CONVERSATION = {
  GAP_MINUTES: 30,
  MAX_ROUNDS: 10,
  MAX_BUFFER_SLOTS: 3,
  FOLLOW_UP_BASE_WAIT: 120,
  FOLLOW_UP_MIN_WAIT: 60,
  FOLLOW_UP_MAX_WAIT: 240
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
    code_modification: 0.9,
    external_communication: 0.4,
    email_send: 0.3,
    x_post: 0.5
  }
} as const

export const PERSONALITY = {
  BASE_WEIGHT: 0.6,
  ADAPTIVE_WEIGHT: 0.4,
  EMOTION_BOOST_FACTOR: 0.3
} as const

export const TRIAGE_DEFAULTS = {
  FALLBACK_CONFIDENCE: 0.5,
  FALLBACK_ESTIMATED_TOKENS: 0,
  OVERRIDE_ESTIMATED_TOKENS: 200
} as const

export const EMOTIONAL_THRESHOLDS = {
  CONNECTION_HIGH: 0.6,
  IDLE_TICK_INTENSITY: 0.5,
  MESSAGE_SENT_INTENSITY: 0.7,
  TASK_SUCCESS_INTENSITY: 0.5,
  EMAIL_SENT_INTENSITY: 0.7,
  TWEET_SENT_INTENSITY: 0.7,
  MESSAGE_RECEIVED_INTENSITY: 0.6,
  GUARDIAN_WARNING_INTENSITY: 0.6,
  GUARDIAN_BLOCK_INTENSITY: 0.8,
  TASK_FAILURE_INTENSITY: 0.6,
  NEW_GOAL_INTENSITY: 0.5,
  GOAL_COMPLETED_INTENSITY: 0.7,
  GOAL_FAILED_INTENSITY: 0.6,
  RELEVANCE_INTERACTION: 0.8,
  RELEVANCE_DEFAULT: 0.7,
  RELEVANCE_RELATIONSHIP: 0.85,
  RELEVANCE_OBSERVATION: 0.7
} as const

export const FOLLOW_UP = {
  CONNECTION_BOOST: 60,
  EXCITEMENT_BOOST: 40,
  BOREDOM_PENALTY: 80
} as const

export const THINKING = {
  SIMPLE_MS: 2000,
  COMPLEX_MS: 4000,
  DEEP_MS: 6000,
  JITTER_FACTOR: 0.3,
  INTER_PARAGRAPH_MIN_MS: 800,
  INTER_PARAGRAPH_MAX_MS: 2500,
  MIN_SPLIT_LENGTH: 200
} as const

export const MESSAGE_DELAY = {
  MIN_BETWEEN_MESSAGES_MS: 500,
  MAX_JITTER_MS: 1500
} as const

export const HUMAN_BRIDGE = {
  INITIAL_TIMEOUT: 30
} as const

export const X = {
  MAX_TWEET_LENGTH: 280,
  MAX_DAILY_PROACTIVE_TWEETS: 2
} as const

export const AFTERTHOUGHT = {
  MAX_TOKENS: 256,
  PAUSE_MIN_MS: 3000,
  PAUSE_MAX_MS: 8000
} as const

export const REFLECTION = {
  COOLDOWN_HOURS: 4,
  INTENSITY_THRESHOLD: 0.35,
  DRIVE_MODIFIER: 0.15,
  DISSONANCE_THRESHOLD: 0.7
} as const

export const EMAIL_DEFAULTS = {
  TRIAGE_DECISION: "complex" as const,
  TRIAGE_CONFIDENCE: 0.8,
  TRIAGE_ESTIMATED_TOKENS: 500,
  RELEVANCE_SCORE: 0.8,
  TRUST_BLOCKED_RELEVANCE: 0.8
} as const
