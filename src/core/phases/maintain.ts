import type { TickSummary } from "@/core/types.ts"
import { db } from "@/db/client.ts"
import { tickLog } from "@/db/schema.ts"
import { getEmotionalState } from "@/emotion/state.ts"
import { sendDriftAlert } from "@/integrations/telegram.ts"
import { log } from "@/lib/logger.ts"
import { logAndCaptureError, trySafe } from "@/lib/result.ts"
import { addBreadcrumb } from "@/lib/sentry.ts"
import {
  getEffectivePersonality,
  getReflectionLastAt,
  pushRecentTickDuration,
  setLastTickSummary
} from "@/memory/working.ts"
import { shouldTriggerReflection } from "@/routine/reflection.ts"
import { detectDrift } from "@/security/guardian.ts"
import type { DriftReport } from "@/security/types.ts"
import { adHocReflectionTask } from "@/trigger/reflection.ts"
import type { ActResult } from "./act.ts"
import type { TickContext } from "./sense.ts"
import type { ThinkResult } from "./think.ts"

async function checkDrift(): Promise<DriftReport> {
  const driftReport = await detectDrift()
  if (!driftReport.healthy) {
    log.warn("Drift detected", { signals: driftReport.signals.length })
    addBreadcrumb(
      "drift",
      "Unhealthy drift detected",
      {
        signals: driftReport.signals
      },
      "warning"
    )
    await sendDriftAlert(driftReport)
  }
  return driftReport
}

async function checkAdHocReflection(): Promise<void> {
  const result = await trySafe("UNKNOWN_ERROR", async () => {
    const [emotion, personality, lastReflectionAt] = await Promise.all([
      getEmotionalState(),
      getEffectivePersonality(),
      getReflectionLastAt()
    ])

    if (!personality) return

    const reflectionCheck = shouldTriggerReflection({ emotion, personality, lastReflectionAt })

    if (reflectionCheck.trigger) {
      log.info("Triggering ad-hoc reflection", { reason: reflectionCheck.reason })
      await adHocReflectionTask.trigger({ reason: reflectionCheck.reason })
    }
  })

  if (result.isErr()) {
    logAndCaptureError(result.error, { phase: "ad_hoc_reflection" })
  }
}

async function persistTickSummary(
  ctx: TickContext,
  thinkResult: ThinkResult,
  actResult: ActResult,
  durationMs: number
): Promise<TickSummary> {
  const { triageResult } = thinkResult

  const tickSummary: TickSummary = {
    tickId: ctx.tickId,
    timestamp: ctx.timestamp,
    triageDecision: triageResult.decision,
    triageReason: triageResult.reason,
    messagesProcessed: 0,
    responseSent: actResult.responseSent,
    modelUsed: actResult.modelUsed,
    tier: triageResult.decision,
    durationMs
  }

  await setLastTickSummary(tickSummary)

  await db.insert(tickLog).values({
    tickId: ctx.tickId,
    timestamp: new Date(ctx.startTime),
    triageDecision: triageResult.decision,
    triageReason: triageResult.reason,
    messagesProcessed: 0,
    responseSent: actResult.responseSent,
    responseText: actResult.responseText ?? null,
    modelUsed: actResult.modelUsed ?? null,
    tier: triageResult.decision,
    nextInterval: "5m",
    durationMs
  })

  log.info("Tick complete", tickSummary)

  return tickSummary
}

export async function maintain(ctx: TickContext, thinkResult: ThinkResult, actResult: ActResult): Promise<TickSummary> {
  await checkDrift()
  await checkAdHocReflection()

  const durationMs = Date.now() - ctx.startTime
  await pushRecentTickDuration(durationMs)

  return persistTickSummary(ctx, thinkResult, actResult, durationMs)
}
