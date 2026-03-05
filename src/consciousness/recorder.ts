import type { AnimaDecision, DeliberateResult, MaintainInput, TickSummary } from "@/consciousness/types.ts"
import { db } from "@/db/client.ts"
import { routineLog, tickLog } from "@/db/schema.ts"
import { saveEmotionalState } from "@/emotion/state.ts"
import type { EmotionalState } from "@/emotion/types.ts"
import { pushRecentAction, pushRecentTickDuration, setLastTickSummary } from "@/memory/working.ts"

/**
 * Log the tick: persist durations, actions, emotion, tick summary, and tick log entry.
 */
export async function logTick(input: MaintainInput, durationMs: number, emotion: EmotionalState): Promise<TickSummary> {
  await pushRecentTickDuration(durationMs)
  await pushRecentAction(input.decision.action)

  const primaryTrigger = input.senseResult.perception.emotionalTriggers[0]?.trigger ?? "message_received"
  await saveEmotionalState(emotion, primaryTrigger, input.tickId)

  const tickSummary: TickSummary = {
    tickId: input.tickId,
    timestamp: input.timestamp,
    action: input.decision.action,
    reasoning: input.decision.reasoning,
    messagesProcessed: input.senseResult.pendingMessages.length,
    responseSent: input.actResult.responseSent,
    durationMs
  }

  await setLastTickSummary(tickSummary)

  await db.insert(tickLog).values({
    tickId: input.tickId,
    timestamp: new Date(input.startTime),
    action: input.decision.action,
    reasoning: input.decision.reasoning,
    messagesProcessed: input.senseResult.pendingMessages.length,
    responseSent: input.actResult.responseSent,
    responseText: input.actResult.responseText ?? null,
    durationMs
  })

  return tickSummary
}

/**
 * Log action-specific results (dream, morning, reflect) to the routine_log table.
 */
export async function logActionResult(decision: AnimaDecision, deliberateResult: DeliberateResult): Promise<void> {
  switch (decision.action) {
    case "dream": {
      if (!deliberateResult.dreamResult) break
      const dr = deliberateResult.dreamResult
      await db.insert(routineLog).values({
        phase: "dream",
        summary: `Dream: ${dr.consolidation ? "consolidation" : "no-consolidation"}, ${dr.creative ? "creative" : "no-creative"}, ${dr.insights.length} insights`,
        insights: {
          consolidationEntries: dr.consolidation?.semanticEntries.length ?? 0,
          creativeConnections: dr.creative?.connections.length ?? 0,
          insights: dr.insights
        }
      })
      break
    }

    case "morning": {
      if (!deliberateResult.morningResult) break
      const mr = deliberateResult.morningResult
      await db.insert(routineLog).values({
        phase: "morning",
        summary: `Morning: ${mr.reflection.insights.length} reflection insights, message ${mr.morningMessage ? "sent" : "empty"}`,
        insights: {
          reflectionInsights: mr.reflection.insights,
          morningMessageLength: mr.morningMessage.length
        },
        emotionAfter: mr.recalibratedEmotion
      })
      break
    }

    case "reflect": {
      if (!deliberateResult.reflectionResult) break
      await db.insert(routineLog).values({
        phase: "reflection",
        summary: `Reflection: ${deliberateResult.reflectionResult.insights.length} insights`,
        insights: deliberateResult.reflectionResult
      })
      break
    }
  }
}
