import * as z from "zod"
import { callIntelligence } from "@/core/intelligence.ts"
import { log } from "@/infra/lib/logger.ts"
import { getRecentOutcomes } from "./outcomes.ts"

const StrategyInsightsOutput = z.object({
  insights: z.array(z.string()).max(3)
})

/**
 * Analyze recent interaction outcomes for strategy patterns that correlate with success.
 */
export async function analyzeStrategyPatterns(days: number = 7): Promise<string[]> {
  const outcomes = await getRecentOutcomes(days)
  const resolved = outcomes.filter((o) => o.outcomeScore !== null)

  if (resolved.length < 3) return []

  const summaryLines = resolved.map((o) => {
    const strategy = o.strategy as Record<string, unknown>
    return `- register: ${strategy.register}, drive: ${strategy.dominantDrive}, time: ${strategy.timeOfDay}, score: ${o.outcomeScore?.toFixed(2)}`
  })

  const result = await callIntelligence({
    system: `You analyze patterns in AI companion interaction outcomes.
Each line shows a strategy (register, dominant drive, time of day) and its outcome score (0-1).
Identify up to 3 actionable patterns: what strategies correlate with high scores? What should be avoided?
Be specific and brief.`,
    userMessage: summaryLines.join("\n"),
    schema: StrategyInsightsOutput,
    maxTokens: 512,
    reasoning: false
  })

  if (result.isErr()) {
    log.warn("Strategy pattern analysis failed", { error: result.error.message })
    return []
  }

  return result.value.insights
}
