import { formatISO, getHours } from "date-fns"
import { db } from "@/db/client.ts"
import { dreamLog } from "@/db/schema.ts"
import type { ConsolidationResult, ReflectionOutput } from "@/dream/types.ts"
import { collectMetrics } from "@/emotion/metrics-check.ts"
import { getEmotionalState } from "@/emotion/state.ts"
import type { EmotionalState, MetricsSnapshot } from "@/emotion/types.ts"
import type { EvolutionType } from "@/evolution/changelog.ts"
import { log } from "@/lib/logger.ts"
import { nowLocal } from "@/lib/time.ts"
import {
  getDreamState,
  setDreamInsights,
  setDreamLastRun,
  setDreamState,
  setReflectionLastAt
} from "@/memory/working.ts"
import { consolidateMemories } from "./consolidation.ts"
import { findCreativeConnections } from "./creative.ts"
import { buildReflectionInput, performReflection } from "./reflection.ts"

export interface EvolutionTrigger {
  type: EvolutionType
  promptId?: string
  insight?: string
  capabilityGap?: string
}

export interface DreamCycleResult {
  consolidation: ConsolidationResult | null
  creative: { connectionsFound: number; goalsCreated: number; insightsStored: number } | null
  reflection: ReflectionOutput | null
  evolutionTriggers: EvolutionTrigger[]
  errors: string[]
}

export function isDreamTime(): boolean {
  const hour = getHours(nowLocal())
  return hour < 6
}

export async function runDreamCycle(): Promise<DreamCycleResult> {
  const currentState = await getDreamState()
  if (currentState === "dreaming") {
    return {
      consolidation: null,
      creative: null,
      reflection: null,
      evolutionTriggers: [],
      errors: ["Dream cycle already in progress"]
    }
  }

  await setDreamState("dreaming")
  const errors: string[] = []
  let consolidationResult: ConsolidationResult | null = null
  let creativeResult: { connectionsFound: number; goalsCreated: number; insightsStored: number } | null = null
  let reflectionOutput: ReflectionOutput | null = null
  let emotionBefore: EmotionalState | null = null
  let metricsSnapshot: MetricsSnapshot | null = null

  try {
    emotionBefore = await getEmotionalState()
  } catch (e) {
    log.error("Dream: failed to read emotion state", { error: String(e) })
    errors.push(`Failed to read emotion state: ${e}`)
  }

  try {
    metricsSnapshot = await collectMetrics()
  } catch (e) {
    log.error("Dream: failed to collect metrics", { error: String(e) })
    errors.push(`Failed to collect metrics: ${e}`)
  }

  try {
    consolidationResult = await consolidateMemories()
    await db.insert(dreamLog).values({
      phase: "consolidation",
      summary: `Processed ${consolidationResult.episodesProcessed} episodes, created ${consolidationResult.semanticEntriesCreated} semantic entries`,
      insights: consolidationResult,
      metricsSnapshot,
      emotionBefore
    })
  } catch (e) {
    log.error("Dream: consolidation failed", { error: String(e) })
    errors.push(`Consolidation failed: ${e}`)
  }

  try {
    creativeResult = await findCreativeConnections()
    await db.insert(dreamLog).values({
      phase: "creative",
      summary: `Found ${creativeResult.connectionsFound} connections, created ${creativeResult.goalsCreated} goals`,
      insights: creativeResult,
      metricsSnapshot,
      emotionBefore
    })
  } catch (e) {
    log.error("Dream: creative connections failed", { error: String(e) })
    errors.push(`Creative connections failed: ${e}`)
  }

  try {
    const reflectionInput = await buildReflectionInput()
    reflectionOutput = await performReflection(reflectionInput)
    let emotionAfterReflection: EmotionalState | null = null
    try {
      emotionAfterReflection = await getEmotionalState()
    } catch (e) {
      log.warn("Failed to get emotional state after reflection", { error: String(e) })
    }
    await db.insert(dreamLog).values({
      phase: "reflection",
      summary: `Generated ${reflectionOutput.insights.length} insights`,
      insights: reflectionOutput,
      metricsSnapshot,
      emotionBefore,
      emotionAfter: emotionAfterReflection
    })
  } catch (e) {
    log.error("Dream: reflection failed", { error: String(e) })
    errors.push(`Reflection failed: ${e}`)
  }

  const allInsights: string[] = []
  if (reflectionOutput?.insights) {
    allInsights.push(...reflectionOutput.insights)
  }
  if (reflectionOutput?.morningMessageDraft) {
    allInsights.push(reflectionOutput.morningMessageDraft)
  }

  if (allInsights.length > 0) {
    await setDreamInsights(allInsights)
  }

  const evolutionTriggers: EvolutionTrigger[] = []

  if (reflectionOutput?.insights) {
    for (const insight of reflectionOutput.insights) {
      const lower = insight.toLowerCase()
      if (
        lower.includes("capability") ||
        lower.includes("missing") ||
        lower.includes("cannot") ||
        lower.includes("should be able to")
      ) {
        evolutionTriggers.push({
          type: "code",
          insight,
          capabilityGap: insight
        })
      }
      if (
        lower.includes("prompt") ||
        lower.includes("triage") ||
        lower.includes("communication style") ||
        lower.includes("response quality")
      ) {
        evolutionTriggers.push({
          type: "prompt",
          promptId: lower.includes("triage") ? "triage" : "responder",
          insight
        })
      }
      if (
        lower.includes("pattern") ||
        lower.includes("recurring") ||
        lower.includes("every day") ||
        lower.includes("routine") ||
        lower.includes("automate") ||
        lower.includes("workflow")
      ) {
        evolutionTriggers.push({
          type: "workflow",
          insight
        })
      }
    }
  }

  if (metricsSnapshot && metricsSnapshot.errorRate > 0.3) {
    evolutionTriggers.push({
      type: "prompt",
      promptId: "triage",
      insight: `High error rate (${(metricsSnapshot.errorRate * 100).toFixed(0)}%) suggests triage prompt needs improvement`
    })
  }

  const nowIso = formatISO(new Date())
  await setDreamLastRun(nowIso)
  await setReflectionLastAt(nowIso)
  await setDreamState("waking")

  return {
    consolidation: consolidationResult,
    creative: creativeResult,
    reflection: reflectionOutput,
    evolutionTriggers,
    errors
  }
}
