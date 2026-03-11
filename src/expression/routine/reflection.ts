import { differenceInHours, parseISO } from "date-fns"
import { desc, eq, inArray } from "drizzle-orm"
import { TRIGGER_INTENSITY } from "@/affect/emotion/constants.ts"
import { collectMetrics } from "@/affect/emotion/metrics.ts"
import {
  getEmotionalState,
  getEmotionHistory,
  processEmotionTrigger,
  saveEmotionalState
} from "@/affect/emotion/state.ts"
import type { EmotionalState } from "@/affect/emotion/types.ts"
import { INTENSITY_DIMENSIONS } from "@/affect/emotion/update.ts"
import { analyzeStrategyPatterns } from "@/cognition/learning/analysis.ts"
import { getBudgetState } from "@/core/budget.ts"
import { analyzeConversationPatterns, getRecentConversationArcs } from "@/expression/communication/patterns.ts"
import { REFLECTION } from "@/expression/routine/constants.ts"
import { db } from "@/infra/db/client.ts"
import { evolutionLog, interactionOutcomes, tickLog } from "@/infra/db/schema.ts"
import { log } from "@/infra/lib/logger.ts"
import { logAndCaptureError } from "@/infra/lib/result.ts"
import { storeWithConsistencyCheck } from "@/memory/consistency.ts"
import { storeEpisode } from "@/memory/episodic.ts"
import { detectGoalConflicts } from "@/memory/goals/conflicts.ts"
import { createGoal, getActiveGoals, getGoalsWithSubGoalProgress } from "@/memory/goals.ts"
import { SemanticCategory, SemanticScope, SemanticSource } from "@/memory/types.ts"
import { generateIdentityStatements } from "@/self/psyche/narrative.ts"
import { addExistentialQuestion } from "@/self/psyche/questions.ts"
import { getRecentNarratives, getSelfConcept, saveIdentityStatements } from "@/self/psyche/state.ts"
import type { ReflectionContext, ReflectionInput, ReflectionOutput } from "./types.ts"

function computeEmotionalIntensity(emotion: EmotionalState): { peak: number; dimension: string } {
  return INTENSITY_DIMENSIONS.reduce(
    (accumulator, dimension) => {
      const deviation = Math.abs(emotion[dimension] - 0.5)
      return deviation > accumulator.peak ? { peak: deviation, dimension } : accumulator
    },
    { peak: 0, dimension: "curiosity" as string }
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

  const decisionTicks = recentTicks.filter((t) => t.responseSent && t.responseText).slice(0, 10)
  const decisionTickIds = decisionTicks.map((t) => t.tickId)

  const outcomes =
    decisionTickIds.length > 0
      ? await db.select().from(interactionOutcomes).where(inArray(interactionOutcomes.tickId, decisionTickIds))
      : []

  const outcomeByTickId = new Map(outcomes.map((o) => [o.tickId, o]))

  const recentDecisions = decisionTicks.map((t) => {
    const outcome = outcomeByTickId.get(t.tickId)
    const strategy = outcome?.strategy as { register?: string; dominantDrive?: string } | null
    return {
      action: t.action,
      reasoning: t.reasoning,
      responseText: t.responseText,
      timestamp: t.timestamp.toISOString(),
      outcome: outcome
        ? {
            register: strategy?.register ?? "unknown",
            dominantDrive: strategy?.dominantDrive ?? null,
            operatorSentiment: outcome.operatorReaction
              ? String((outcome.operatorReaction as { sentiment?: string }).sentiment ?? null)
              : null,
            outcomeScore: outcome.outcomeScore
          }
        : null
    }
  })

  const conversationPatternsResult = await analyzeConversationPatterns()

  const ticksWithMessages = recentTicks.filter((t) => t.messagesProcessed > 0)
  const operatorSentiment =
    ticksWithMessages.length > 0
      ? ticksWithMessages.filter((t) => t.responseSent).length / ticksWithMessages.length
      : undefined

  const outcomePatterns = await analyzeStrategyPatterns()

  const staleGoalTitles = activeGoals.filter((g) => g.status === "stale" || g.status === "overdue").map((g) => g.title)

  const goalConflicts =
    activeGoals.length >= 2
      ? (await detectGoalConflicts(activeGoals)).map((c) => `${c.goalA} vs ${c.goalB}: ${c.description}`)
      : []

  return {
    successRate: metrics.successRate,
    errorRate: metrics.errorRate,
    costToday: budget.consumedToday,
    tickCount: metrics.tickCount,
    operatorInteractions: recentTicks.filter((t) => t.responseSent).length,
    operatorSentiment,
    outcomePatterns: outcomePatterns.length > 0 ? outcomePatterns : undefined,
    staleGoals: staleGoalTitles.length > 0 ? staleGoalTitles : undefined,
    goalConflicts: goalConflicts.length > 0 ? goalConflicts : undefined,
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
    goalProgress: await (async () => {
      const withProgress = await getGoalsWithSubGoalProgress(10)
      const withChildren = withProgress.filter((g) => g.childCount > 0)
      return withChildren.length > 0
        ? withChildren.map((g) => ({
            title: g.title,
            progress: g.childProgress,
            childCount: g.childCount
          }))
        : undefined
    })(),
    failedExperiments: failedExperiments.map((e) => ({
      type: e.type,
      description: e.description,
      outcome: e.outcome
    })),
    recentDecisions: recentDecisions.length > 0 ? recentDecisions : undefined,
    recentConversationArcs: await (async () => {
      const arcs = await getRecentConversationArcs(5)
      return arcs.length > 0
        ? arcs.map((arc) => ({
            tone: arc.tone,
            themes: Array.isArray(arc.themes) ? (arc.themes as string[]) : [],
            engagement: arc.operatorEngagement
          }))
        : undefined
    })(),
    conversationPatterns:
      conversationPatternsResult.patterns.length > 0 ? conversationPatternsResult.patterns : undefined,
    recurringUnresolved:
      conversationPatternsResult.recurringUnresolved.length > 0
        ? conversationPatternsResult.recurringUnresolved
        : undefined
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

  for (const insight of output.insights) {
    await storeEpisode(`Reflection insight: ${insight}`, "dream", { relevanceScore: 0.85 })
    await storeWithConsistencyCheck(
      SemanticCategory.enum.insight,
      `reflection-${crypto.randomUUID()}`,
      insight,
      SemanticSource.enum.reflection,
      0.8,
      SemanticScope.enum.self
    )
  }

  if (output.selfInsights && output.selfInsights.length > 0) {
    for (const selfInsight of output.selfInsights) {
      await storeWithConsistencyCheck(
        SemanticCategory.enum.insight,
        `self-${crypto.randomUUID()}`,
        selfInsight,
        SemanticSource.enum.reflection,
        0.85,
        SemanticScope.enum.self
      )
    }
    log.info("Stored self-insights from reflection", { count: output.selfInsights.length })
  }

  if (output.counterfactuals && output.counterfactuals.length > 0) {
    for (const cf of output.counterfactuals) {
      const cfValue = `Original: ${cf.originalAction}. Alternative: ${cf.alternativeAction}. Expected: ${cf.expectedOutcome}. Lesson: ${cf.lesson}`
      await storeWithConsistencyCheck(
        SemanticCategory.enum.insight,
        `counterfactual-${crypto.randomUUID()}`,
        cfValue,
        SemanticSource.enum.reflection,
        0.75,
        SemanticScope.enum.self
      )
    }
    log.info("Stored counterfactuals from reflection", { count: output.counterfactuals.length })
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
