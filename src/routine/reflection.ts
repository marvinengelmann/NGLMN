import { differenceInHours, parseISO, subDays } from "date-fns"
import { desc, eq, gte } from "drizzle-orm"
import { EMOTIONAL_THRESHOLDS, REFLECTION } from "@/config/constants.ts"
import { getBudgetState } from "@/core/budget.ts"
import { callIntelligence, REASONING } from "@/core/intelligence.ts"
import { db } from "@/db/client.ts"
import { dreamLog, evolutionLog, personalityDna, tickLog } from "@/db/schema.ts"
import { collectMetrics } from "@/emotion/metrics.ts"
import { getEmotionalState, getEmotionHistory, processEmotionTrigger, saveEmotionalState } from "@/emotion/state.ts"
import type { EmotionalState } from "@/emotion/types.ts"
import { log } from "@/lib/logger.ts"
import { logAndCaptureError } from "@/lib/result.ts"
import { captureError } from "@/lib/sentry.ts"
import { nowISO } from "@/lib/time.ts"
import { storeEpisode } from "@/memory/episodic.ts"
import { createGoal, getActiveGoals } from "@/memory/goals.ts"
import { storeKnowledge } from "@/memory/semantic.ts"
import { setReflectionLastAt } from "@/memory/working.ts"
import { updateAdaptiveLayer } from "@/personality/evolution.ts"
import type { PersonalityLayer } from "@/personality/types.ts"
import { REFLECTION_SYSTEM_PROMPT } from "@/prompts/dream.ts"
import type { ReflectionInput, ReflectionResult } from "./types.ts"
import { ReflectionOutput } from "./types.ts"

export interface ReflectionContext {
  emotion: EmotionalState
  personality: PersonalityLayer
  lastReflectionAt: string | null
}

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

function computeIntrospectionDrive(personality: PersonalityLayer): number {
  return (
    personality.curiosity * 0.3 +
    personality.empathy * 0.3 +
    personality.abstraction * 0.2 +
    (1 - personality.proactivity) * 0.2
  )
}

/**
 * Determine if ANIMA feels the urge to reflect.
 * Driven by emotional intensity and introspective personality traits,
 * not by failure metrics.
 */
export function shouldTriggerReflection(ctx: ReflectionContext): { trigger: boolean; reason: string } {
  if (ctx.lastReflectionAt) {
    const hoursSince = differenceInHours(new Date(), parseISO(ctx.lastReflectionAt))
    if (hoursSince < REFLECTION.COOLDOWN_HOURS) {
      return { trigger: false, reason: `Reflection cooldown (${hoursSince}h / ${REFLECTION.COOLDOWN_HOURS}h)` }
    }
  }

  const { peak, dimension } = computeEmotionalIntensity(ctx.emotion)
  const drive = computeIntrospectionDrive(ctx.personality)
  const threshold = REFLECTION.INTENSITY_THRESHOLD - drive * REFLECTION.DRIVE_MODIFIER

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

  return { trigger: false, reason: "No introspective urge" }
}

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
  const result = await callIntelligence({
    model: REASONING,
    system: REFLECTION_SYSTEM_PROMPT,
    userMessage: JSON.stringify(input),
    schema: ReflectionOutput,
    maxTokens: 4096
  })

  if (result.isErr()) {
    log.warn("performReflection: callIntelligence failed", { error: result.error.message })
    return { insights: [] }
  }

  const output = result.value

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

    await processEmotionTrigger({ trigger: "new_goal", intensity: EMOTIONAL_THRESHOLDS.NEW_GOAL_INTENSITY }, "new_goal")
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
    await saveEmotionalState(corrected, "dream_correction")
  }

  for (const insight of output.insights) {
    await storeEpisode(`Reflection insight: ${insight}`, "dream", { relevanceScore: 0.85 })
    const storeResult = await storeKnowledge("insight", `reflection-${Date.now()}`, insight, "reflection", 0.8)
    if (storeResult.isErr()) logAndCaptureError(storeResult.error)
  }

  if (output.selfInsights && output.selfInsights.length > 0) {
    for (const selfInsight of output.selfInsights) {
      const storeResult = await storeKnowledge(
        "insight",
        `self-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        selfInsight,
        "reflection",
        0.85,
        "self"
      )
      if (storeResult.isErr()) logAndCaptureError(storeResult.error)
    }
    log.info("Stored self-insights from reflection", { count: output.selfInsights.length })
  }

  return output
}

/**
 * Full reflection pipeline: build input → perform → persist → return.
 * Used by both the ad-hoc reflection task and the morning routine.
 */
export async function runReflection(reason: string): Promise<ReflectionResult> {
  log.info("Starting reflection", { reason })

  try {
    const input = await buildReflectionInput()
    const output = await performReflection(input)

    await setReflectionLastAt(nowISO())

    await db.insert(dreamLog).values({
      phase: "reflection",
      summary: `Reflection (${reason}): ${output.insights.length} insights.`,
      insights: output
    })

    log.info("Reflection complete", {
      reason,
      insights: output.insights.length,
      goals: output.newGoals?.length ?? 0
    })

    return { reason, output }
  } catch (e) {
    captureError(e, { phase: "reflection", reason })
    log.error("Reflection failed", { error: String(e) })
    return { reason, output: { insights: [] } }
  }
}
