export const BUDGET = {
  DAILY_LIMIT: 5.0,
  LOW_BUDGET_THRESHOLD: 0.1
} as const

export const CONTEXT_TOKEN_BUDGET = 2_000_000
export const MAX_OUTPUT_TOKENS = 30_000

export const HEARTBEAT = {
  CRON: "* * * * *",
  CONCURRENCY: 10,
  BUSY_TTL: 1800,
  CONVERSATION_POLL_TIMEOUT: 60,
  MAX_CONVERSATION_WAIT: 300
} as const

export const CONTEXT_LIMITS = {
  maxGoals: 10,
  maxEpisodes: 15,
  maxSemantic: 20,
  maxRelationship: 10,
  maxEmotionHistory: 10,
  maxGraphEntities: 15
} as const

export const HEALTH_CHECK_INTERVAL = 900

export const HEALTH_CHECK = {
  EXPECTED_INTERVAL_SECONDS: 300,
  OK_MULTIPLIER: 2,
  STALE_MULTIPLIER: 4
} as const
