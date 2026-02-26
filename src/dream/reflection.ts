import { subDays } from "date-fns"
import { desc, eq, gte } from "drizzle-orm"
import { jsonrepair } from "jsonrepair"
import { logAndCaptureError } from "@/config/result-helpers.ts"
import { getBudgetState } from "@/core/budget.ts"
import { db } from "@/db/client.ts"
import { evolutionLog, personalityDna, tickLog } from "@/db/schema.ts"
import { collectMetrics } from "@/emotion/metrics-check.ts"
import { getEmotionalState, getEmotionHistory, saveEmotionalState } from "@/emotion/state.ts"
import type { EmotionalState } from "@/emotion/types.ts"
import { callClaude, OPUS, SONNET } from "@/integrations/anthropic.ts"
import { log } from "@/lib/logger.ts"
import { storeEpisode } from "@/memory/episodic.ts"
import { createGoal, getActiveGoals } from "@/memory/goals.ts"
import { storeKnowledge } from "@/memory/semantic.ts"
import { updateAdaptiveLayer } from "@/personality/evolution.ts"
import type { PersonalityLayer } from "@/personality/types.ts"
import { REFLECTION_SYSTEM_PROMPT } from "@/prompts/dream.ts"
import type { ReflectionInput, ReflectionOutput } from "./types.ts"

export async function buildReflectionInput(): Promise<ReflectionInput> {
  const [metrics, emotionRows, activeGoals, budget] = await Promise.all([
    collectMetrics(),
    getEmotionHistory(24),
    getActiveGoals(),
    getBudgetState()
  ])

  const sevenDaysAgo = subDays(new Date(), 7)
  const personalityChanges = await db
    .select({
      version: personalityDna.version,
      changelog: personalityDna.changelog,
      createdAt: personalityDna.createdAt
    })
    .from(personalityDna)
    .where(gte(personalityDna.createdAt, sevenDaysAgo))
    .orderBy(desc(personalityDna.createdAt))

  const failedExperiments = await db
    .select({
      type: evolutionLog.type,
      description: evolutionLog.description,
      outcome: evolutionLog.outcome
    })
    .from(evolutionLog)
    .where(eq(evolutionLog.outcome, "failure"))
    .orderBy(desc(evolutionLog.createdAt))
    .limit(10)

  const operatorTicks = await db
    .select()
    .from(tickLog)
    .where(eq(tickLog.responseSent, true))
    .orderBy(desc(tickLog.createdAt))
    .limit(50)

  const operatorSentiment =
    operatorTicks.length > 0
      ? operatorTicks.filter((t) => t.messagesProcessed > 0).length / operatorTicks.length
      : undefined

  return {
    successRate: metrics.successRate,
    errorRate: metrics.errorRate,
    costToday: budget.consumedToday,
    tickCount: metrics.tickCount,
    operatorInteractions: operatorTicks.length,
    operatorSentiment,
    emotionalHistory: emotionRows.map((r) => ({
      state: r.state as ReflectionInput["emotionalHistory"][0]["state"],
      trigger: r.trigger,
      createdAt: r.createdAt?.toISOString() ?? new Date().toISOString()
    })),
    personalityChanges: personalityChanges.map((r) => ({
      version: r.version,
      changelog: r.changelog,
      createdAt: r.createdAt?.toISOString() ?? new Date().toISOString()
    })),
    unresolvedGoals: activeGoals.map((g) => ({
      title: g.title,
      priority: g.priority ?? 0.5,
      source: g.source
    })),
    failedExperiments: failedExperiments.map((e) => ({
      type: e.type,
      description: e.description,
      outcome: e.outcome
    }))
  }
}

export async function performReflection(input: ReflectionInput): Promise<ReflectionOutput> {
  const result = await callClaude({
    model: OPUS,
    system: REFLECTION_SYSTEM_PROMPT,
    userMessage: JSON.stringify(input),
    maxTokens: 4096
  })

  if (result.isErr()) {
    log.warn("performReflection: callClaude failed", { error: result.error.message })
    return { insights: [], emotionalCorrections: {}, personalityDeltas: {}, newGoals: [] }
  }

  const output = JSON.parse(jsonrepair(result.value)) as ReflectionOutput

  if (output.personalityDeltas && Object.keys(output.personalityDeltas).length > 0) {
    const deltas: Partial<PersonalityLayer> = {}
    for (const [key, value] of Object.entries(output.personalityDeltas)) {
      if (
        [
          "directness",
          "curiosity",
          "humor",
          "caution",
          "proactivity",
          "verbosity",
          "warmth",
          "structure",
          "empathy",
          "abstraction"
        ].includes(key)
      ) {
        ;(deltas as Record<string, number>)[key] = value
      }
    }
    if (Object.keys(deltas).length > 0) {
      await updateAdaptiveLayer(deltas, `Dream reflection: ${output.insights[0] ?? "personality adjustment"}`)
    }
  }

  if (output.newGoals && output.newGoals.length > 0) {
    for (const goal of output.newGoals) {
      const goalResult = await createGoal(goal.title, goal.description, "dream", goal.priority, {
        emotionalWeight: goal.priority
      })
      if (goalResult.isErr()) logAndCaptureError(goalResult.error)
    }
  }

  if (output.emotionalCorrections && Object.keys(output.emotionalCorrections).length > 0) {
    const currentEmotion = await getEmotionalState()
    const validDimensions: (keyof EmotionalState)[] = [
      "curiosity",
      "satisfaction",
      "frustration",
      "boredom",
      "excitement",
      "caution",
      "connection"
    ]
    const corrected = { ...currentEmotion }
    for (const [key, delta] of Object.entries(output.emotionalCorrections)) {
      if (validDimensions.includes(key as keyof EmotionalState)) {
        corrected[key as keyof EmotionalState] = Math.max(
          0,
          Math.min(1, corrected[key as keyof EmotionalState] + delta)
        )
      }
    }
    await saveEmotionalState(corrected, "tick_start")
  }

  for (const insight of output.insights) {
    await storeEpisode(`Reflection insight: ${insight}`, "dream", { relevanceScore: 0.85 })
    const storeResult = await storeKnowledge("insight", `reflection-${Date.now()}`, insight, "reflection", 0.8)
    if (storeResult.isErr()) logAndCaptureError(storeResult.error)
  }

  return output
}

/**
 * Determine if an ad-hoc reflection should be triggered based on recent events.
 */
export function shouldTriggerReflection(events: { failures: number; rollbacks: number; budgetPercent: number }): {
  trigger: boolean
  reason: string
} {
  if (events.failures >= 3) {
    return { trigger: true, reason: `${events.failures} recent failures detected` }
  }
  if (events.rollbacks >= 2) {
    return { trigger: true, reason: `${events.rollbacks} recent rollbacks detected` }
  }
  if (events.budgetPercent > 90) {
    return { trigger: true, reason: `Budget at ${events.budgetPercent.toFixed(0)}%` }
  }
  return { trigger: false, reason: "No reflection trigger met" }
}

/**
 * Perform a lightweight reflection using Sonnet (not Opus).
 * Stores insights but does not apply personality deltas (too risky outside dream).
 */
export async function performMiniReflection(triggerReason: string): Promise<ReflectionOutput> {
  const [metrics, emotionHistory, budget] = await Promise.all([
    collectMetrics(),
    getEmotionHistory(5),
    getBudgetState()
  ])

  const miniInput = {
    triggerReason,
    errorRate: metrics.errorRate,
    successRate: metrics.successRate,
    rollbackCount: metrics.rollbackCount,
    budgetPercent: (budget.consumedToday / budget.dailyLimit) * 100,
    recentEmotions: emotionHistory.slice(0, 3).map((e) => ({
      trigger: e.trigger,
      createdAt: e.createdAt?.toISOString() ?? "?"
    }))
  }

  const miniResult = await callClaude({
    model: SONNET,
    system: `You are ANIMA's ad-hoc reflection module. Analyze the trigger and recent data.
Return ONLY JSON: {"insights": ["insight1", "insight2"], "newGoals": [{"title": "...", "description": "...", "priority": 0.7}]}
Keep insights actionable and brief. No personality changes — this is a quick check-in, not a deep reflection.`,
    userMessage: JSON.stringify(miniInput),
    maxTokens: 1024
  })

  if (miniResult.isErr()) {
    log.warn("performMiniReflection: callClaude failed", { error: miniResult.error.message })
    return { insights: [], emotionalCorrections: {}, personalityDeltas: {}, newGoals: [] }
  }

  const output = JSON.parse(jsonrepair(miniResult.value)) as ReflectionOutput

  for (const insight of output.insights) {
    await storeEpisode(`Ad-hoc reflection: ${insight}`, "dream", { relevanceScore: 0.75 })
  }

  if (output.newGoals) {
    for (const goal of output.newGoals) {
      const goalResult = await createGoal(goal.title, goal.description, "dream", goal.priority, {
        emotionalWeight: goal.priority
      })
      if (goalResult.isErr()) logAndCaptureError(goalResult.error)
    }
  }

  return output
}
