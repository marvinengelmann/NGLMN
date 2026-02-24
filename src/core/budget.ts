import { formatISO } from "date-fns"
import * as z from "zod"
import { BUDGET } from "@/config/constants.ts"
import { redis } from "@/integrations/redis.ts"

export const BudgetState = z.object({
  consumedToday: z.number(),
  dailyLimit: z.number(),
  remainingToday: z.number()
})
export type BudgetState = z.infer<typeof BudgetState>

const TTL_SECONDS = 86_400

function getBudgetKey(): string {
  return `working:budget:${formatISO(new Date(), { representation: "date" })}`
}

const MODEL_COST_PER_MTOK: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-haiku-4-5-20251001": { input: 1.0, output: 5.0, cacheRead: 0.1, cacheWrite: 1.25 },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0, cacheRead: 0.3, cacheWrite: 3.75 },
  "claude-opus-4-6": { input: 15.0, output: 75.0, cacheRead: 1.5, cacheWrite: 18.75 }
}

/**
 * Estimate the USD cost of a Claude API call from model and usage data.
 */
export function estimateCallCost(
  model: string,
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens?: number; cacheCreationTokens?: number }
): number {
  const rates = MODEL_COST_PER_MTOK[model]
  if (!rates) return 0

  const inputCost = usage.inputTokens * rates.input
  const outputCost = usage.outputTokens * rates.output
  const cacheReadCost = (usage.cacheReadTokens ?? 0) * rates.cacheRead
  const cacheWriteCost = (usage.cacheCreationTokens ?? 0) * rates.cacheWrite

  return (inputCost + outputCost + cacheReadCost + cacheWriteCost) / 1_000_000
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
  const consumed = (await redis.get<number>(getBudgetKey())) ?? 0
  return {
    consumedToday: consumed,
    dailyLimit: BUDGET.DAILY_LIMIT,
    remainingToday: Math.max(0, BUDGET.DAILY_LIMIT - consumed)
  }
}
