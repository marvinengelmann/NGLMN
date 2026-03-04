import { differenceInHours, parseISO } from "date-fns"
import { desc, eq } from "drizzle-orm"
import { REFLECTION, TRIGGER_INTENSITY } from "@/config/constants.ts"
import { getBudgetState } from "@/core/budget.ts"
import { db } from "@/db/client.ts"
import { evolutionLog, tickLog } from "@/db/schema.ts"
import { collectMetrics } from "@/emotion/metrics.ts"
import { getEmotionalState, getEmotionHistory, processEmotionTrigger, saveEmotionalState } from "@/emotion/state.ts"
import type { EmotionalState } from "@/emotion/types.ts"
import { log } from "@/lib/logger.ts"
import { logAndCaptureError } from "@/lib/result.ts"
import { storeEpisode } from "@/memory/episodic.ts"
import { createGoal, getActiveGoals } from "@/memory/goals.ts"
import { storeKnowledge } from "@/memory/semantic.ts"
import { SemanticCategory, SemanticScope, SemanticSource } from "@/memory/types.ts"
import type { ReflectionContext, ReflectionInput, ReflectionOutput } from "./types.ts"

function computeEmotionalIntensity(emotion: EmotionalState): { peak: number; dimension: string } {
  let maxDeviation = 0
  let peakDimension = "curiosity"
  for (const [dim, val] of Object.entries(emotion)) {
    const deviation = Math.abs(val - 0.5)
    if (deviation > maxDeviation) {
      maxDeviation = deviation
      peakDimension = dim
    }
  }
  return { peak: maxDeviation, dimension: peakDimension }
}

/**
 * Determine if ANIMA feels the urge to reflect.
 * Driven by emotional intensity, not by failure metrics.
 */
export function shouldTriggerReflection(ctx: ReflectionContext): { trigger: boolean; reason: string } {
  if (ctx.lastReflectionAt) {
    const hoursSince = differenceInHours(new Date(), parseISO(ctx.lastReflectionAt))
    if (hoursSince < REFLECTION.COOLDOWN_HOURS) {
      return { trigger: false, reason: `Reflection cooldown (${hoursSince}h / ${REFLECTION.COOLDOWN_HOURS}h)` }
    }
  }

  const { peak, dimension } = computeEmotionalIntensity(ctx.emotion)
  const threshold = REFLECTION.INTENSITY_THRESHOLD - REFLECTION.DRIVE_MODIFIER * 0.5

  if (peak >= threshold) {
    const value = ctx.emotion[dimension as keyof EmotionalState]
    const direction = value > 0.5 ? "high" : "low"
    return { trigger: true, reason: `Strong ${dimension} (${direction}, ${value.toFixed(2)}) driving introspection` }
  }

  const d = REFLECTION.DISSONANCE_THRESHOLD
  const e = ctx.emotion

  if (e.excitement > d && e.caution > d) {
    return { trigger: true, reason: "Emotional dissonance: excitement and caution pulling in opposite directions" }
  }
  if (e.connection > d && e.frustration > d) {
    return { trigger: true, reason: "Emotional dissonance: feeling connected yet frustrated" }
  }
  if (e.curiosity > d && e.boredom > d) {
    return { trigger: true, reason: "Emotional dissonance: curious yet bored — seeking meaning" }
  }
  if (e.confidence > d && e.caution > d) {
    return { trigger: true, reason: "Emotional dissonance: confident yet cautious — conflicting impulses" }
  }
  if (e.energy < 0.3 && e.excitement > 0.7) {
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
    for (const goal of output.newGoals) {
      const goalResult = await createGoal(goal.title, goal.description, "dream", goal.priority, {
        emotionalWeight: goal.priority
      })
      if (goalResult.isErr()) logAndCaptureError(goalResult.error)
    }

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
    const corrected = { ...currentEmotion }
    for (const [key, delta] of Object.entries(output.emotionalCorrections)) {
      if (validDimensions.includes(key as keyof EmotionalState)) {
        corrected[key as keyof EmotionalState] = Math.max(
          0,
          Math.min(1, corrected[key as keyof EmotionalState] + delta)
        )
      }
    }
    await saveEmotionalState(corrected, "dream_correction")
    log.info("Reflection emotional corrections", { corrections: output.emotionalCorrections })
  }

  for (const insight of output.insights) {
    await storeEpisode(`Reflection insight: ${insight}`, "dream", { relevanceScore: 0.85 })
    const storeResult = await storeKnowledge(
      SemanticCategory.enum.insight,
      `reflection-${Date.now()}`,
      insight,
      SemanticSource.enum.reflection,
      0.8,
      SemanticScope.enum.self
    )
    if (storeResult.isErr()) logAndCaptureError(storeResult.error)
  }

  if (output.selfInsights && output.selfInsights.length > 0) {
    for (const selfInsight of output.selfInsights) {
      const storeResult = await storeKnowledge(
        SemanticCategory.enum.insight,
        `self-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        selfInsight,
        SemanticSource.enum.reflection,
        0.85,
        SemanticScope.enum.self
      )
      if (storeResult.isErr()) logAndCaptureError(storeResult.error)
    }
    log.info("Stored self-insights from reflection", { count: output.selfInsights.length })
  }
}
