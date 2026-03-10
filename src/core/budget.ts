import { formatISO } from "date-fns"
import * as z from "zod"
import type { BudgetState } from "@/core/types.ts"
import { BUDGET } from "@/infra/config/constants.ts"
import { redis } from "@/infra/integrations/redis.ts"

const TTL_SECONDS = 86_400

function getBudgetKey(): string {
  return `working:budget:${formatISO(new Date(), { representation: "date" })}`
}

const COST_PER_MTOK = { input: 0.2, output: 0.5 }

/**
 * Estimate the USD cost of an LLM API call from token usage.
 */
export function estimateCallCost(usage: { inputTokens: number; outputTokens: number }): number {
  return (usage.inputTokens * COST_PER_MTOK.input + usage.outputTokens * COST_PER_MTOK.output) / 1_000_000
}

async function getConsumedToday(): Promise<number> {
  return z.coerce
    .number()
    .catch(0)
    .parse(await redis.get(getBudgetKey()))
}

/**
 * Track API cost for budget awareness.
 */
export async function trackApiCost(costUsd: number): Promise<void> {
  const key = getBudgetKey()
  await redis.incrbyfloat(key, costUsd)
  await redis.expire(key, TTL_SECONDS)
}

/**
 * Get current budget state from Redis.
 */
export async function getBudgetState(): Promise<BudgetState> {
  const consumed = await getConsumedToday()
  return {
    consumedToday: consumed,
    dailyLimit: BUDGET.DAILY_LIMIT,
    remainingToday: Math.max(0, BUDGET.DAILY_LIMIT - consumed)
  }
}
