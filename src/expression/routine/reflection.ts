import { differenceInHours, parseISO } from "date-fns"
import { desc, eq } from "drizzle-orm"
import { TRIGGER_INTENSITY } from "@/affect/emotion/constants.ts"
import { collectMetrics } from "@/affect/emotion/metrics.ts"
import {
  getEmotionalState,
  getEmotionHistory,
  processEmotionTrigger,
  saveEmotionalState
} from "@/affect/emotion/state.ts"
import type { EmotionalState } from "@/affect/emotion/types.ts"
import { getBudgetState } from "@/core/budget.ts"
import { REFLECTION } from "@/expression/routine/constants.ts"
import { db } from "@/infra/db/client.ts"
import { evolutionLog, tickLog } from "@/infra/db/schema.ts"
import { log } from "@/infra/lib/logger.ts"
import { logAndCaptureError } from "@/infra/lib/result.ts"
import { storeEpisode } from "@/memory/episodic.ts"
import { createGoal, getActiveGoals } from "@/memory/goals.ts"
import { storeKnowledge } from "@/memory/semantic.ts"
import { SemanticCategory, SemanticScope, SemanticSource } from "@/memory/types.ts"
import { generateIdentityStatements } from "@/self/psyche/narrative.ts"
import { addExistentialQuestion } from "@/self/psyche/questions.ts"
import { getRecentNarratives, getSelfConcept, saveIdentityStatements } from "@/self/psyche/state.ts"
import type { ReflectionContext, ReflectionInput, ReflectionOutput } from "./types.ts"

function computeEmotionalIntensity(emotion: EmotionalState): { peak: number; dimension: string } {
  return Object.entries(emotion).reduce(
    (accumulator, [dimension, value]) => {
      const deviation = Math.abs(value - 0.5)
      return deviation > accumulator.peak ? { peak: deviation, dimension } : accumulator
    },
    { peak: 0, dimension: "curiosity" }
  )
}

/**
 * Determine if ANIMA feels the urge to reflect.
 * Driven by emotional intensity, not by failure metrics.
 */
export function shouldTriggerReflection(context: ReflectionContext): { trigger: boolean; reason: string } {
  if (context.lastReflectionAt) {
    const hoursSince = differenceInHours(new Date(), parseISO(context.lastReflectionAt))
    if (hoursSince < REFLECTION.COOLDOWN_HOURS) {
      return { trigger: false, reason: `Reflection cooldown (${hoursSince}h / ${REFLECTION.COOLDOWN_HOURS}h)` }
    }
  }

  const { peak, dimension } = computeEmotionalIntensity(context.emotion)
  const threshold = REFLECTION.INTENSITY_THRESHOLD - REFLECTION.DRIVE_MODIFIER * 0.5

  if (peak >= threshold) {
    const value = context.emotion[dimension as keyof EmotionalState]
    const direction = value > 0.5 ? "high" : "low"
    return { trigger: true, reason: `Strong ${dimension} (${direction}, ${value.toFixed(2)}) driving introspection` }
  }

  const dissonanceThreshold = REFLECTION.DISSONANCE_THRESHOLD
  const emotion = context.emotion

  if (emotion.excitement > dissonanceThreshold && emotion.caution > dissonanceThreshold) {
    return { trigger: true, reason: "Emotional dissonance: excitement and caution pulling in opposite directions" }
  }
  if (emotion.connection > dissonanceThreshold && emotion.frustration > dissonanceThreshold) {
    return { trigger: true, reason: "Emotional dissonance: feeling connected yet frustrated" }
  }
  if (emotion.curiosity > dissonanceThreshold && emotion.boredom > dissonanceThreshold) {
    return { trigger: true, reason: "Emotional dissonance: curious yet bored — seeking meaning" }
  }
  if (emotion.confidence > dissonanceThreshold && emotion.caution > dissonanceThreshold) {
    return { trigger: true, reason: "Emotional dissonance: confident yet cautious — conflicting impulses" }
  }
  if (emotion.energy < 0.3 && emotion.excitement > 0.7) {
    return { trigger: true, reason: "Emotional dissonance: exhausted yet excited — needs resolution" }
  }

  return { trigger: false, reason: "No introspective urge" }
}

/**
 * Build reflection input data — pure SENSE helper.
 * Gathers metrics, emotion history, goals, and failed experiments.
 */
export async function buildReflectionInput(): Promise<ReflectionInput> {
  const [metrics, emotionRows, activeGoals, budget] = await Promise.all([
    collectMetrics(),
    getEmotionHistory(24),
    getActiveGoals(),
    getBudgetState()
  ])

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

  const recentTicks = await db.select().from(tickLog).orderBy(desc(tickLog.createdAt)).limit(50)

  const ticksWithMessages = recentTicks.filter((t) => t.messagesProcessed > 0)
  const operatorSentiment =
    ticksWithMessages.length > 0
      ? ticksWithMessages.filter((t) => t.responseSent).length / ticksWithMessages.length
      : undefined

  return {
    successRate: metrics.successRate,
    errorRate: metrics.errorRate,
    costToday: budget.consumedToday,
    tickCount: metrics.tickCount,
    operatorInteractions: recentTicks.filter((t) => t.responseSent).length,
    operatorSentiment,
    emotionalHistory: emotionRows.map((r) => ({
      state: r.state as ReflectionInput["emotionalHistory"][0]["state"],
      trigger: r.trigger,
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

/**
 * Apply reflection output — pure ACT helper.
 * Persists goals, knowledge, episodes, and emotional corrections.
 */
export async function applyReflectionResult(output: ReflectionOutput): Promise<void> {
  if (output.newGoals && output.newGoals.length > 0) {
    await Promise.all(
      output.newGoals.map(async (goal) => {
        const goalResult = await createGoal(goal.title, goal.description, "dream", goal.priority, {
          emotionalWeight: goal.priority
        })
        if (goalResult.isErr()) logAndCaptureError(goalResult.error)
      })
    )

    log.info("Reflection goals created", { count: output.newGoals.length })
    await processEmotionTrigger({ trigger: "new_goal", intensity: TRIGGER_INTENSITY.NEW_GOAL }, "new_goal")
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
      "connection",
      "confidence",
      "energy"
    ]
    const corrected = Object.entries(output.emotionalCorrections).reduce(
      (accumulator, [key, delta]) => {
        if (validDimensions.includes(key as keyof EmotionalState)) {
          accumulator[key as keyof EmotionalState] = Math.max(
            0,
            Math.min(1, accumulator[key as keyof EmotionalState] + delta)
          )
        }
        return accumulator
      },
      { ...currentEmotion }
    )
    await saveEmotionalState(corrected, "dream_correction")
    log.info("Reflection emotional corrections", { corrections: output.emotionalCorrections })
  }

  await Promise.all(
    output.insights.map(async (insight) => {
      await storeEpisode(`Reflection insight: ${insight}`, "dream", { relevanceScore: 0.85 })
      const storeResult = await storeKnowledge(
        SemanticCategory.enum.insight,
        `reflection-${crypto.randomUUID()}`,
        insight,
        SemanticSource.enum.reflection,
        0.8,
        SemanticScope.enum.self
      )
      if (storeResult.isErr()) logAndCaptureError(storeResult.error)
    })
  )

  if (output.selfInsights && output.selfInsights.length > 0) {
    await Promise.all(
      output.selfInsights.map(async (selfInsight) => {
        const storeResult = await storeKnowledge(
          SemanticCategory.enum.insight,
          `self-${crypto.randomUUID()}`,
          selfInsight,
          SemanticSource.enum.reflection,
          0.85,
          SemanticScope.enum.self
        )
        if (storeResult.isErr()) logAndCaptureError(storeResult.error)
      })
    )
    log.info("Stored self-insights from reflection", { count: output.selfInsights.length })
  }

  const existentialQuestions = (output.existentialQuestions ?? []).slice(0, 1)
  await Promise.all(existentialQuestions.map((q) => addExistentialQuestion(q)))

  const [selfConcept, recentNarratives] = await Promise.all([getSelfConcept(), getRecentNarratives()])
  const statements = await generateIdentityStatements(selfConcept, recentNarratives)
  if (statements.length > 0) {
    await saveIdentityStatements(statements)
    log.info("Identity statements regenerated", { count: statements.length })
  }
}
