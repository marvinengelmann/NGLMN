import { db } from "@/db/client.ts"
import { dreamLog } from "@/db/schema.ts"
import type { ConsolidationResult } from "@/dream/types.ts"
import { collectMetrics } from "@/emotion/metrics.ts"
import { getEmotionalState } from "@/emotion/state.ts"
import type { EmotionalState, MetricsSnapshot } from "@/emotion/types.ts"
import { log } from "@/lib/logger.ts"
import { captureError } from "@/lib/sentry.ts"
import { isDreamTime, nowISO } from "@/lib/time.ts"
import { getDreamState, setDreamLastRun, setDreamState } from "@/memory/working.ts"
import { consolidateMemories } from "./consolidation.ts"
import { findCreativeConnections } from "./creative.ts"

export interface DreamCycleResult {
  action: string
  consolidation?: ConsolidationResult | null
  creative?: { connectionsFound: number; goalsCreated: number; insightsStored: number } | null
  errors?: string[]
  reason?: string
}

/**
 * Runs the full dream cycle lifecycle: checks dream time, runs consolidation
 * and creative phases, captures errors, and logs outcome.
 */
export async function runDreamCycle(): Promise<DreamCycleResult> {
  if (!isDreamTime()) {
    log.info("Not dream time, skipping")
    return { action: "skipped", reason: "not dream time" }
  }

  log.info("Starting dream cycle")
  const result = await executeDreamPhases()

  if (result.errors.length > 0) {
    for (const err of result.errors) {
      captureError(err, { phase: "dream_cycle" })
    }
    log.warn("Dream cycle completed with errors", { errors: result.errors })
  } else {
    log.info("Dream cycle completed successfully", {
      consolidation: result.consolidation,
      creative: result.creative
    })
  }

  return { action: "completed", ...result }
}

interface DreamPhasesResult {
  consolidation: ConsolidationResult | null
  creative: { connectionsFound: number; goalsCreated: number; insightsStored: number } | null
  errors: string[]
}

async function executeDreamPhases(): Promise<DreamPhasesResult> {
  const currentState = await getDreamState()
  if (currentState === "dreaming") {
    return {
      consolidation: null,
      creative: null,
      errors: ["Dream cycle already in progress"]
    }
  }

  await setDreamState("dreaming")
  const errors: string[] = []
  let consolidationResult: ConsolidationResult | null = null
  let creativeResult: { connectionsFound: number; goalsCreated: number; insightsStored: number } | null = null
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

  await setDreamLastRun(nowISO())
  await setDreamState("waking")

  return {
    consolidation: consolidationResult,
    creative: creativeResult,
    errors
  }
}
