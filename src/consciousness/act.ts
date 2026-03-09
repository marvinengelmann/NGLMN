import { differenceInMinutes, parseISO } from "date-fns"
import { EVENT_SUBSTANCE_MAP } from "@/altered/events.ts"
import { startAlteredState } from "@/altered/state.ts"
import { sendMessages } from "@/communication/messaging.ts"
import { EMOTIONAL_THRESHOLDS, MESSAGE_DELAY, TRIGGER_INTENSITY } from "@/config/constants.ts"
import { db } from "@/db/client.ts"
import { narrativeEntries } from "@/db/schema.ts"
import { isDissonanceSignificant } from "@/dissonance/check.ts"
import { executeDream } from "@/dream/executor.ts"
import { setDreamState } from "@/dream/state.ts"
import { getEmotionalState, saveEmotionalState } from "@/emotion/state.ts"
import {
  computeEmotionalIntensity,
  computeEmotionalUpdate,
  computeValence,
  summarizeEmotions
} from "@/emotion/update.ts"
import { runEvolutionCycle } from "@/evolution/cycle.ts"
import {
  setCalendarLastCheck,
  setEmailLastCheck,
  setSocialMediaLastBrowse,
  setSocialMediaLastPost
} from "@/integrations/cooldowns.ts"
import { sendMessageWithReply } from "@/integrations/telegram.ts"
import { postToX } from "@/integrations/x.ts"
import { log } from "@/lib/logger.ts"
import { logAndCaptureError, trySafe } from "@/lib/result.ts"
import { nowISO, sleep } from "@/lib/time.ts"
import { storeEpisode, storeHumorEpisode, storeRelationshipEpisode } from "@/memory/episodic.ts"
import { executeGoalUpdate } from "@/memory/goals.ts"
import { storeKnowledge } from "@/memory/semantic.ts"
import { getLastTickSummary } from "@/memory/working.ts"
import { buildNarrativeSummary, generateNarrativeEntry } from "@/psyche/narrative.ts"
import { addGrowthArc, addNarrativeEntry, savePsycheSnapshot, saveSelfConcept } from "@/psyche/state.ts"
import { detectGrowthArc, updateSelfConcept } from "@/psyche/update.ts"
import { executeMorning, executeReflection } from "@/routine/executor.ts"
import { validatePublicContent } from "@/security/privacy.ts"
import { saveSomaticState } from "@/soma/state.ts"
import { computeSomaticUpdate, drainSocialBattery } from "@/soma/update.ts"
import { executeWorkflow } from "@/workflow/engine.ts"
import { recordActiveTick } from "./gating.ts"
import { startChosenLifeEvent, startSleepEvent } from "./lifecycle.ts"
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
      for (const correction of decision.corrections) {
        await sleep(MESSAGE_DELAY.MIN_BETWEEN_MESSAGES_MS + Math.random() * MESSAGE_DELAY.MAX_JITTER_MS)
        await trySafe("TELEGRAM_ERROR", () => sendMessageWithReply(correction.text, correction.replyTo))
      }
    }
  }

  await executeAction(deliberateResult)

  if (deliberateResult.calendarChecked) {
    await setCalendarLastCheck(nowISO())
  }

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
    const currentEmotion = await getEmotionalState()
    const outcomeEmotion = computeEmotionalUpdate(currentEmotion, [
      { trigger: "message_sent", intensity: TRIGGER_INTENSITY.MESSAGE_SENT }
    ])
    await saveEmotionalState(outcomeEmotion, "message_sent")

    const drainedSoma = drainSocialBattery(
      feelResult.soma,
      decision.messages.length,
      senseResult.pendingMessages.length
    )
    const postActionSoma = computeSomaticUpdate(drainedSoma, outcomeEmotion, 0)
    await saveSomaticState(postActionSoma, "post_action")

    await recordActiveTick()
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

  const growthArc = detectGrowthArc(updatedConcept, feelResult.selfConcept, nowISO())
  if (growthArc) {
    await addGrowthArc(growthArc)
    log.info("Growth arc detected", { observation: growthArc.observation })
  }

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
      await addNarrativeEntry(entry)

      await savePsycheSnapshot({
        selfConcept: updatedConcept,
        aspirations: [],
        fears: [],
        narrativeSummary: buildNarrativeSummary([entry]),
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
        else {
          log.info("Dream cycle completed")
          await startSleepEvent()
        }
      }
      break
    }

    case "morning": {
      const morningResult = deliberateResult.morningResult
      if (morningResult) {
        const result = await trySafe("MORNING_ERROR", () => executeMorning(morningResult))
        if (result.isErr()) {
          logAndCaptureError(result.error, { phase: "act_morning" })
          await setDreamState("idle")
        } else {
          log.info("Morning routine completed")
        }
      }
      break
    }

    case "life_event": {
      const { lifeEventType, lifeEventDetail } = decision.actionPayload ?? {}
      if (lifeEventType) {
        await startChosenLifeEvent(lifeEventType, lifeEventDetail)
        const substance = EVENT_SUBSTANCE_MAP[lifeEventType]
        if (substance) {
          await startAlteredState(substance, lifeEventType)
        }
      }
      break
    }

    case "store_knowledge": {
      const { knowledgeCategory, knowledgeKey, knowledgeValue, knowledgeScope } = decision.actionPayload ?? {}
      if (knowledgeCategory && knowledgeKey && knowledgeValue) {
        const result = await storeKnowledge(
          knowledgeCategory,
          knowledgeKey,
          knowledgeValue,
          "observation",
          0.8,
          knowledgeScope ?? "self"
        )
        if (result.isErr()) logAndCaptureError(result.error, { phase: "act_store_knowledge" })
        else log.info("Knowledge stored via action", { category: knowledgeCategory, key: knowledgeKey })
      }
      break
    }

    case "check_email": {
      await setEmailLastCheck(nowISO())
      log.info("Email check completed")
      break
    }

    case "social_media": {
      const { socialMediaMode, xPostText } = decision.actionPayload ?? {}

      if (socialMediaMode === "browse") {
        await setSocialMediaLastBrowse(nowISO())
        log.info("Social media browse completed")
      }

      if (socialMediaMode === "post" && xPostText) {
        const privacyCheck = await validatePublicContent(xPostText)
        if (!privacyCheck.passed) {
          log.warn("Social media post blocked by privacy guardian", { issues: privacyCheck.issues })
          break
        }

        const postResult = await trySafe("X_ERROR", () => postToX(xPostText))
        if (postResult.isErr()) {
          logAndCaptureError(postResult.error, { phase: "act_social_media_post" })
        } else {
          await setSocialMediaLastPost(nowISO())
          await storeEpisode(`Posted to X: "${xPostText}" — ${postResult.value.url}`, "social_media", {
            relevanceScore: 0.6,
            valence: 0.3
          })
          log.info("Posted to X", { tweetId: postResult.value.id, url: postResult.value.url })
        }
      }
      break
    }
  }
}
