import { BUDGET, MAX_TOKENS, type TierKey } from "@/config/constants.ts"
import { getBudgetState } from "@/core/budget.ts"
import type { TriageResult } from "@/core/types.ts"
import { type ClaudeModel, HAIKU, OPUS, SONNET } from "@/integrations/anthropic.ts"

/**
 * Select the appropriate model based on triage result and budget.
 * Budget-aware: if < 10% remaining → Haiku only.
 */
export async function selectModel(triageResult: TriageResult): Promise<ClaudeModel> {
  const budget = await getBudgetState()

  if (budget.remainingToday < budget.dailyLimit * BUDGET.LOW_BUDGET_THRESHOLD) {
    return HAIKU
  }

  switch (triageResult.decision) {
    case "idle":
    case "simple":
      return HAIKU
    case "complex":
      return SONNET
    case "deep":
      return OPUS
  }
}

/**
 * Get the max tokens allowed for each tier.
 */
export function getMaxTokensForTier(tier: TierKey): number {
  return MAX_TOKENS[tier]
}

/**
 * Legacy helper — still used for triage phase.
 */
export function getModelForPhase(_phase: "triage"): ClaudeModel {
  return HAIKU
}
