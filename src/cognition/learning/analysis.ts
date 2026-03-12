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
 * Extracts the most common operator mood and passes it as lesson context.
 * Returns the number of lessons created or reinforced.
 */
export async function analyzeAndLearn(days: number = 7): Promise<number> {
  const outcomes = await getRecentOutcomes(days)
  const resolved = outcomes.filter((o) => o.outcomeScore !== null)

  if (resolved.length < 3) return 0

  const moodCounts = new Map<string, number>()
  for (const o of resolved) {
    const reaction = o.operatorReaction as Record<string, unknown> | null
    const sentiment = String(reaction?.sentiment ?? "neutral")
    moodCounts.set(sentiment, (moodCounts.get(sentiment) ?? 0) + 1)
  }
  const dominantMood = [...moodCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "neutral"

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
    await addLesson(
      insight.insight,
      {
        register: insight.applicableRegister,
        timeOfDay: insight.applicableTimeOfDay,
        dominantDrive: insight.applicableDrive,
        operatorMood: dominantMood
      },
      "interaction"
    )
    stored++
  }

  await setLastAnalysisTimestamp()
  log.info("Strategy analysis complete", { insightsStored: stored, outcomesAnalyzed: resolved.length })
  return stored
}
