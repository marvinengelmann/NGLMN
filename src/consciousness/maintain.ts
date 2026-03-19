import { maintainEmotion } from "@/affect/emotion/maintain.ts"
import { maintainActivityCounters } from "@/affect/soma/maintain.ts"
import { maintainCognition } from "@/cognition/maintain.ts"
import { maintainCommunication } from "@/expression/communication/maintain.ts"
import { maintainFreeEnergy } from "@/fep/maintain.ts"
import { maintainHealth } from "@/governance/health/maintain.ts"
import { handleDriftCheck } from "@/governance/security/guardian.ts"
import { routineLog, tickLog } from "@/infra/db/schema.ts"
import type { WriteBuffer } from "@/infra/lib/buffer.ts"
import { log } from "@/infra/lib/logger.ts"
import { maintainMemory } from "@/memory/maintain.ts"
import { getLastTickSummary, pushRecentAction, pushRecentTickDuration } from "@/memory/working.ts"
import { maintainRhythm } from "@/perception/rhythm/maintain.ts"
import { maintainRelational } from "@/relational/maintain.ts"
import { maintainSelf } from "@/self/maintain.ts"
import type { DeliberateResult, FeelingResult, MaintainInput, TickSummary } from "./types.ts"

function extractMessageTexts(input: MaintainInput): string[] {
  return input.senseResult.pendingMessages.map((m) => m.text || "")
}

/**
 * MAINTAIN phase — persist state, detect drift, update attachment, track phases and idle ticks.
 */
export async function maintain(
  input: MaintainInput,
  deliberateResult: DeliberateResult,
  feelResult: FeelingResult,
  buffer: WriteBuffer
): Promise<TickSummary> {
  await handleDriftCheck()

  const messageTexts = extractMessageTexts(input)
  const hasMessages = input.senseResult.pendingMessages.length > 0
  const lastTick = await getLastTickSummary()

  await maintainHealth(input.senseResult.health)

  await maintainRelational(feelResult, lastTick, buffer)

  await maintainActivityCounters(
    input.decision.action,
    input.actResult.responseSent,
    input.senseResult.moodContext.isDreaming,
    input.senseResult.moodContext.inConversation,
    buffer
  )

  await maintainCommunication(
    feelResult.emotion,
    messageTexts,
    input.decision.messages.map((m) => m.text),
    buffer
  )

  await maintainCognition(
    input.decision.action,
    messageTexts,
    input.actResult.responseSent,
    feelResult.emotion,
    feelResult.freeEnergyState,
    feelResult.neuromodulatoryState,
    input.senseResult.rawTriggers,
    buffer
  )

  await maintainMemory(
    input.decision.action,
    input.decision.reasoning,
    feelResult.emotion.connection,
    input.actResult.responseSent,
    hasMessages,
    messageTexts,
    input.actResult.responseText,
    input.tickId,
    buffer
  )

  await maintainSelf(
    feelResult.emotion,
    messageTexts,
    input.decision.reasoning,
    feelResult.dissociativeState,
    lastTick,
    buffer
  )

  await maintainFreeEnergy(feelResult.freeEnergyState, feelResult.neuromodulatoryState, buffer)

  await maintainRhythm()

  const durationMs = Date.now() - input.startTime
  await pushRecentTickDuration(durationMs)
  await pushRecentAction(input.decision.action)

  const primaryTrigger = input.senseResult.perception.emotionalTriggers[0]?.trigger ?? "ambient"
  await maintainEmotion(
    input.actResult.responseSent,
    hasMessages,
    input.actResult.postActEmotion,
    feelResult.emotion,
    primaryTrigger,
    input.tickId,
    lastTick,
    buffer
  )

  const tickSummary = buildTickSummary(input, durationMs)
  buffer.stage("working:tick:last", tickSummary)
  buffer.stagePostgres(tickLog, {
    tickId: input.tickId,
    timestamp: new Date(input.startTime),
    action: input.decision.action,
    reasoning: input.decision.reasoning,
    messagesProcessed: input.senseResult.pendingMessages.length,
    responseSent: input.actResult.responseSent,
    responseText: input.actResult.responseText ?? null,
    durationMs
  })

  stageActionResult(buffer, input.decision, deliberateResult)

  log.info("Tick complete", tickSummary)
  return tickSummary
}

function buildTickSummary(input: MaintainInput, durationMs: number): TickSummary {
  return {
    tickId: input.tickId,
    timestamp: input.timestamp,
    action: input.decision.action,
    reasoning: input.decision.reasoning,
    messagesProcessed: input.senseResult.pendingMessages.length,
    responseSent: input.actResult.responseSent,
    durationMs
  }
}

function stageActionResult(
  buffer: WriteBuffer,
  decision: MaintainInput["decision"],
  deliberateResult: DeliberateResult
): void {
  switch (decision.action) {
    case "dream": {
      if (!deliberateResult.dreamResult) break
      const dreamResult = deliberateResult.dreamResult
      buffer.stagePostgres(routineLog, {
        phase: "dream",
        summary: `Dream: ${dreamResult.consolidation ? "consolidation" : "no-consolidation"}, ${dreamResult.creative ? "creative" : "no-creative"}, ${dreamResult.insights.length} insights`,
        insights: {
          consolidationEntries: dreamResult.consolidation?.semanticEntries.length ?? 0,
          creativeConnections: dreamResult.creative?.connections.length ?? 0,
          insights: dreamResult.insights
        }
      })
      break
    }

    case "morning": {
      if (!deliberateResult.morningResult) break
      const morningResult = deliberateResult.morningResult
      buffer.stagePostgres(routineLog, {
        phase: "morning",
        summary: `Morning: ${morningResult.reflection.insights.length} reflection insights, message ${morningResult.morningMessage ? "sent" : "empty"}`,
        insights: {
          reflectionInsights: morningResult.reflection.insights,
          morningMessageLength: morningResult.morningMessage.length
        },
        emotionAfter: morningResult.recalibratedEmotion
      })
      break
    }

    case "reflect": {
      if (!deliberateResult.reflectionResult) break
      buffer.stagePostgres(routineLog, {
        phase: "reflection",
        summary: `Reflection: ${deliberateResult.reflectionResult.insights.length} insights`,
        insights: deliberateResult.reflectionResult
      })
      break
    }
  }
}
