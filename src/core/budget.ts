import { formatISO } from "date-fns"
import * as z from "zod"
import { BUDGET } from "@/config/constants.ts"
import { redis } from "@/integrations/redis.ts"

export const BudgetState = z.object({
  consumedToday: z.coerce.number(),
  dailyLimit: z.coerce.number(),
  remainingToday: z.coerce.number()
})
export type BudgetState = z.infer<typeof BudgetState>

const TTL_SECONDS = 86_400

function getBudgetKey(): string {
  return `working:budget:${formatISO(new Date(), { representation: "date" })}`
}

const MODEL_COST_PER_MTOK: Record<string, { input: number; output: number }> = {
  "xai/grok-4-1-fast-non-reasoning": { input: 0.2, output: 0.5 },
  "xai/grok-4-1-fast-reasoning": { input: 0.2, output: 0.5 }
}

/**
 * Estimate the USD cost of an LLM API call from model and usage data.
 */
export function estimateCallCost(model: string, usage: { inputTokens: number; outputTokens: number }): number {
  const rates = MODEL_COST_PER_MTOK[model]
  if (!rates) return 0

  const inputCost = usage.inputTokens * rates.input
  const outputCost = usage.outputTokens * rates.output

  return (inputCost + outputCost) / 1_000_000
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
  const current = await getConsumedToday()
  await redis.set(key, current + costUsd, { ex: TTL_SECONDS })
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
