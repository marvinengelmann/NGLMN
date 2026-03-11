import * as z from "zod"
import { callIntelligence } from "@/core/intelligence.ts"
import { log } from "@/infra/lib/logger.ts"
import { STRATEGY_ANALYSIS_PROMPT } from "@/prompts/consciousness.ts"
import { addLesson, setLastAnalysisTimestamp } from "./lessons.ts"
import { getRecentOutcomes } from "./outcomes.ts"
import { StructuredInsight } from "./types.ts"

const StrategyInsightsOutput = z.object({
  insights: z.array(StructuredInsight).max(3)
})

/**
 * Analyze recent interaction outcomes for strategy patterns and store as lessons.
 * Returns the number of lessons created or reinforced.
 */
export async function analyzeAndLearn(days: number = 7): Promise<number> {
  const outcomes = await getRecentOutcomes(days)
  const resolved = outcomes.filter((o) => o.outcomeScore !== null)

  if (resolved.length < 3) return 0

  const summaryLines = resolved.map((o) => {
    const strategy = o.strategy as Record<string, unknown>
    return `- register: ${strategy.register}, drive: ${strategy.dominantDrive}, time: ${strategy.timeOfDay}, topic: ${strategy.topicHint ?? "none"}, score: ${o.outcomeScore?.toFixed(2)}`
  })

  const result = await callIntelligence({
    system: STRATEGY_ANALYSIS_PROMPT,
    userMessage: summaryLines.join("\n"),
    schema: StrategyInsightsOutput,
    maxTokens: 512,
    reasoning: false
  })

  if (result.isErr()) {
    log.warn("Strategy pattern analysis failed", { error: result.error.message })
    return 0
  }

  let stored = 0
  for (const insight of result.value.insights) {
    await addLesson(insight.insight, {
      register: insight.applicableRegister,
      timeOfDay: insight.applicableTimeOfDay,
      dominantDrive: insight.applicableDrive
    })
    stored++
  }

  await setLastAnalysisTimestamp()
  log.info("Strategy analysis complete", { insightsStored: stored, outcomesAnalyzed: resolved.length })
  return stored
}

/**
 * Analyze recent interaction outcomes for strategy patterns that correlate with success.
 * @deprecated Use analyzeAndLearn instead for structured lesson storage.
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
    system: STRATEGY_ANALYSIS_PROMPT,
    userMessage: summaryLines.join("\n"),
    schema: z.object({ insights: z.array(z.string()).max(3) }),
    maxTokens: 512,
    reasoning: false
  })

  if (result.isErr()) {
    log.warn("Strategy pattern analysis failed", { error: result.error.message })
    return []
  }

  return result.value.insights
}
