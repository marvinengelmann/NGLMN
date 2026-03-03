import { sendMessages } from "@/communication/messaging.ts"
import { EMOTIONAL_THRESHOLDS } from "@/config/constants.ts"
import { executeDream } from "@/dream/executor.ts"
import { saveEmotionalState } from "@/emotion/state.ts"
import { computeEmotionalUpdate } from "@/emotion/update.ts"
import { runEvolutionCycle } from "@/evolution/cycle.ts"
import { log } from "@/lib/logger.ts"
import { logAndCaptureError, trySafe } from "@/lib/result.ts"
import { storeEpisode, storeRelationshipEpisode } from "@/memory/episodic.ts"
import { executeGoalUpdate } from "@/memory/goals.ts"
import { executeMorning, executeReflection } from "@/routine/executor.ts"
import { executeWorkflow } from "@/workflow/engine.ts"
import type { ActResult, SenseResult, ThinkResult } from "./types.ts"

/**
 * ACT phase — pure executor. No LLM calls, no decisions.
 * Sends messages and executes the action decided by THINK.
 */
export async function act(thinkResult: ThinkResult, senseResult: SenseResult): Promise<ActResult> {
  const { decision } = thinkResult
  let responseSent = false
  let responseText: string | undefined

  if (decision.messages.length > 0) {
    const result = await sendMessages(decision)
    responseSent = result.responseSent
    responseText = result.responseText
  }

  await executeAction(thinkResult)

  if (decision.workflowId) {
    const workflow = senseResult.triggeredWorkflows.find((wf) => wf.id === decision.workflowId)
    if (workflow) {
      const result = await trySafe("WORKFLOW_ERROR", () => executeWorkflow(workflow, senseResult.systemPrompt))
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
    const outcomeEmotion = computeEmotionalUpdate(senseResult.emotion, [
      { trigger: "message_sent", intensity: EMOTIONAL_THRESHOLDS.MESSAGE_SENT_INTENSITY }
    ])
    await saveEmotionalState(outcomeEmotion, "message_sent")
  }

  const summary = `${decision.action}: ${decision.reasoning.slice(0, 200)}`
  if (responseSent && senseResult.emotion.connection > EMOTIONAL_THRESHOLDS.CONNECTION_HIGH) {
    await storeRelationshipEpisode(summary)
  } else {
    await storeEpisode(summary, responseSent ? "interaction" : "observation", {
      relevanceScore: EMOTIONAL_THRESHOLDS.RELEVANCE_DEFAULT
    })
  }

  return { responseSent, responseText, actionExecuted: decision.action }
}

async function executeAction(thinkResult: ThinkResult): Promise<void> {
  const { decision } = thinkResult

  switch (decision.action) {
    case "idle":
      break

    case "reflect": {
      const reflectionOutput = thinkResult.reflectionResult
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
      const dreamResult = thinkResult.dreamResult
      if (dreamResult) {
        const result = await trySafe("DREAM_ERROR", () => executeDream(dreamResult))
        if (result.isErr()) logAndCaptureError(result.error, { phase: "act_dream" })
        else log.info("Dream cycle completed")
      }
      break
    }

    case "morning": {
      const morningResult = thinkResult.morningResult
      if (morningResult) {
        const result = await trySafe("MORNING_ERROR", () => executeMorning(morningResult))
        if (result.isErr()) logAndCaptureError(result.error, { phase: "act_morning" })
        else log.info("Morning routine completed")
      }
      break
    }
  }
}
