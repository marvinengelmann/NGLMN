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
