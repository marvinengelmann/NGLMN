import { differenceInMinutes, parseISO } from "date-fns"
import { sendMessages } from "@/communication/messaging.ts"
import { EMOTIONAL_THRESHOLDS, MESSAGE_DELAY, TRIGGER_INTENSITY } from "@/config/constants.ts"
import { db } from "@/db/client.ts"
import { narrativeEntries } from "@/db/schema.ts"
import { isDissonanceSignificant } from "@/dissonance/check.ts"
import { executeDream } from "@/dream/executor.ts"
import { saveEmotionalState } from "@/emotion/state.ts"
import {
  computeEmotionalIntensity,
  computeEmotionalUpdate,
  computeValence,
  summarizeEmotions
} from "@/emotion/update.ts"
import { runEvolutionCycle } from "@/evolution/cycle.ts"
import { sendMessageWithReply } from "@/integrations/telegram.ts"
import { log } from "@/lib/logger.ts"
import { logAndCaptureError, trySafe } from "@/lib/result.ts"
import { storeEpisode, storeHumorEpisode, storeRelationshipEpisode } from "@/memory/episodic.ts"
import { executeGoalUpdate } from "@/memory/goals.ts"
import { getLastTickSummary } from "@/memory/working.ts"
import { generateNarrativeEntry } from "@/psyche/narrative.ts"
import { savePsycheSnapshot, saveSelfConcept } from "@/psyche/state.ts"
import { updateSelfConcept } from "@/psyche/update.ts"
import { executeMorning, executeReflection } from "@/routine/executor.ts"
import { saveSomaticState } from "@/soma/state.ts"
import { computeSomaticUpdate } from "@/soma/update.ts"
import { executeWorkflow } from "@/workflow/engine.ts"
import type { ActResult, DeliberateResult, FeelingResult, SenseResult } from "./types.ts"

/**
 * ACT phase — pure executor. No LLM calls, no decisions.
 * Sends messages, executes action, then updates soma + psyche post-action.
 */
export async function act(
  deliberateResult: DeliberateResult,
  senseResult: SenseResult,
  feelResult: FeelingResult
): Promise<ActResult> {
  const { decision } = deliberateResult
  let responseSent = false
  let responseText: string | undefined

  const routineHandlesMessaging = decision.action === "morning" || decision.action === "dream"
  if (decision.messages.length > 0 && !routineHandlesMessaging) {
    const messagingResult = await trySafe("TELEGRAM_ERROR", () => sendMessages(decision))
    if (messagingResult.isOk()) {
      responseSent = messagingResult.value.responseSent
      responseText = messagingResult.value.responseText
    } else {
      logAndCaptureError(messagingResult.error, { phase: "act_messaging" })
    }

    if (responseSent && decision.corrections.length > 0) {
      await decision.corrections.reduce(async (prev, correction) => {
        await prev
        const delay = MESSAGE_DELAY.MIN_BETWEEN_MESSAGES_MS + Math.random() * MESSAGE_DELAY.MAX_JITTER_MS
        await new Promise((resolve) => setTimeout(resolve, delay))
        await trySafe("TELEGRAM_ERROR", () => sendMessageWithReply(correction.text, correction.replyTo))
      }, Promise.resolve())
    }
  }

  await executeAction(deliberateResult)

  if (decision.workflowId) {
    const workflow = senseResult.triggeredWorkflows.find((wf) => wf.id === decision.workflowId)
    if (workflow) {
      const result = await trySafe("WORKFLOW_ERROR", () => executeWorkflow(workflow, deliberateResult.systemPrompt))
      if (result.isErr()) {
        logAndCaptureError(result.error, { phase: "act_workflow", workflowId: workflow.id })
      } else {
        log.info("Workflow executed", {
          workflowId: workflow.id,
          workflowName: workflow.name,
          success: result.value.success
        })
      }
    }
  }

  if (responseSent) {
    const outcomeEmotion = computeEmotionalUpdate(feelResult.emotion, [
      { trigger: "message_sent", intensity: TRIGGER_INTENSITY.MESSAGE_SENT }
    ])
    await saveEmotionalState(outcomeEmotion, "message_sent")

    const postActionSoma = computeSomaticUpdate(feelResult.soma, outcomeEmotion, 0)
    await saveSomaticState(postActionSoma, "post_action")
  }

  const lastTick = await getLastTickSummary()
  const elapsedHours = lastTick ? differenceInMinutes(new Date(), parseISO(lastTick.timestamp)) / 60 : 1 / 60

  const isAutoAction = decision.action !== "idle" && decision.action !== "reflect"
  const updatedConcept = updateSelfConcept(feelResult.selfConcept, {
    recentTaskSuccess: responseSent,
    recentTaskFailure: decision.messages.length > 0 && !routineHandlesMessaging && !responseSent,
    messageSentCount: decision.messages.length,
    emotionalIntensity: computeEmotionalIntensity(feelResult.emotion),
    operatorEngagement: senseResult.pendingMessages.length > 0,
    autonomousAction: isAutoAction,
    vulnerabilityOpen: feelResult.vulnerability.windowOpen,
    dissonanceDetected: isDissonanceSignificant(feelResult.dissonance.activeDissonance),
    elapsedHours
  })
  await saveSelfConcept(updatedConcept)

  if (decision.action === "reflect" || decision.action === "morning") {
    const emotionSummary = summarizeEmotions(feelResult.emotion)

    const entry = await generateNarrativeEntry(
      `${decision.action}: ${decision.reasoning.slice(0, 200)}`,
      emotionSummary,
      updatedConcept
    )
    if (entry) {
      await db.insert(narrativeEntries).values({
        content: entry.content,
        emotionalColoring: entry.emotionalColoring,
        significance: entry.significance
      })

      await savePsycheSnapshot({
        selfConcept: updatedConcept,
        aspirations: [],
        fears: [],
        narrativeSummary: `[${entry.emotionalColoring}] ${entry.content}`,
        timestamp: entry.timestamp
      })

      log.info("Narrative entry persisted", { significance: entry.significance })
    }
  }

  const summary = `${decision.action}: ${decision.reasoning.slice(0, 200)}`
  const valence = computeValence(feelResult.emotion)
  if (
    responseSent &&
    feelResult.register === "playful" &&
    feelResult.emotion.connection > EMOTIONAL_THRESHOLDS.CONNECTION_HIGH
  ) {
    await storeHumorEpisode(summary, { isInsideJoke: senseResult.pendingMessages.length > 0 })
  } else if (responseSent && feelResult.emotion.connection > EMOTIONAL_THRESHOLDS.CONNECTION_HIGH) {
    await storeRelationshipEpisode(summary, { valence })
  } else {
    await storeEpisode(summary, responseSent ? "interaction" : "observation", {
      relevanceScore: EMOTIONAL_THRESHOLDS.RELEVANCE_DEFAULT,
      valence
    })
  }

  return { responseSent, responseText, actionExecuted: decision.action }
}

async function executeAction(deliberateResult: DeliberateResult): Promise<void> {
  const { decision } = deliberateResult

  switch (decision.action) {
    case "idle":
      break

    case "reflect": {
      const reflectionOutput = deliberateResult.reflectionResult
      if (reflectionOutput) {
        const result = await trySafe("REFLECTION_ERROR", () => executeReflection(reflectionOutput))
        if (result.isErr()) logAndCaptureError(result.error, { phase: "act_reflect" })
        else log.info("Reflection completed")
      }
      break
    }

    case "update_goal": {
      await executeGoalUpdate(decision)
      break
    }

    case "evolve": {
      const evolveResult = await trySafe("EVOLUTION_ERROR", () =>
        runEvolutionCycle({
          insight: decision.actionPayload?.evolutionInsight,
          capabilityGap: decision.actionPayload?.capabilityGap
        })
      )
      if (evolveResult.isErr()) {
        logAndCaptureError(evolveResult.error, { phase: "act_evolve" })
      } else {
        log.info("Evolution cycle completed", { action: evolveResult.value.action })
      }
      break
    }

    case "dream": {
      const dreamResult = deliberateResult.dreamResult
      if (dreamResult) {
        const result = await trySafe("DREAM_ERROR", () => executeDream(dreamResult))
        if (result.isErr()) logAndCaptureError(result.error, { phase: "act_dream" })
        else log.info("Dream cycle completed")
      }
      break
    }

    case "morning": {
      const morningResult = deliberateResult.morningResult
      if (morningResult) {
        const result = await trySafe("MORNING_ERROR", () => executeMorning(morningResult))
        if (result.isErr()) logAndCaptureError(result.error, { phase: "act_morning" })
        else log.info("Morning routine completed")
      }
      break
    }
  }
}
