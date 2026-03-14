import { differenceInMinutes, getHours, parseISO } from "date-fns"
import { startAlteredState } from "@/affect/altered/state.ts"
import { EMOTIONAL_THRESHOLDS, TRIGGER_INTENSITY } from "@/affect/emotion/constants.ts"
import type { EmotionalState } from "@/affect/emotion/types.ts"
import {
  computeEmotionalIntensity,
  computeEmotionalUpdate,
  computeValence,
  summarizeEmotions
} from "@/affect/emotion/update.ts"
import { computeSomaticUpdate, drainSocialBattery } from "@/affect/soma/update.ts"
import { createOutcome } from "@/cognition/learning/outcomes.ts"
import type { InteractionStrategy } from "@/cognition/learning/types.ts"
import { MESSAGE_DELAY } from "@/expression/communication/constants.ts"
import { sendMessages } from "@/expression/communication/messaging.ts"
import { getActiveConversation } from "@/expression/communication/state.ts"
import { generateCreativeOutput } from "@/expression/creativity/generate.ts"
import { executeDream } from "@/expression/dream/executor.ts"
import { setDreamState } from "@/expression/dream/state.ts"
import { executeMorning, executeReflection } from "@/expression/routine/executor.ts"
import { runEvolutionCycle } from "@/governance/evolution/cycle.ts"
import { validatePublicContent } from "@/governance/security/privacy.ts"
import { executeWorkflow } from "@/governance/workflow/engine.ts"
import { emotionHistory, narrativeEntries, psycheSnapshots, somaticHistory } from "@/infra/db/schema.ts"
import {
  setCalendarLastCheck,
  setEmailLastCheck,
  setSocialMediaLastBrowse,
  setSocialMediaLastPost
} from "@/infra/integrations/cooldowns.ts"
import { sendMessageWithReply } from "@/infra/integrations/telegram.ts"
import { postToX } from "@/infra/integrations/x.ts"
import { log } from "@/infra/lib/logger.ts"
import { logAndCaptureError, trySafe } from "@/infra/lib/result.ts"
import { nowISO, nowLocal, sleep } from "@/infra/lib/time.ts"
import { storeEpisode, storeHumorEpisode, storeRelationshipEpisode } from "@/memory/episodic.ts"
import { executeGoalUpdate } from "@/memory/goals.ts"
import { storeKnowledge } from "@/memory/semantic.ts"
import { getLastTickSummary } from "@/memory/working.ts"
import { isDissonanceSignificant } from "@/self/dissonance/compute.ts"
import { startChosenLifeEvent, startSleepEvent } from "@/self/lifecycle.ts"
import { buildNarrativeSummary, generateNarrativeEntry } from "@/self/psyche/narrative.ts"
import { getGrowthArcs, getRecentNarratives } from "@/self/psyche/state.ts"
import { detectGrowthArc, updateSelfConcept } from "@/self/psyche/update.ts"
import { recordActiveTick } from "./gating.ts"
import type { WriteBuffer } from "./pipeline/persistence.ts"
import type { ActResult, DeliberateResult, FeelingResult, SenseResult } from "./types.ts"

/**
 * ACT phase — pure executor. No LLM calls, no decisions.
 * Sends messages, executes action, then updates soma + psyche post-action.
 */
export async function act(
  deliberateResult: DeliberateResult,
  senseResult: SenseResult,
  feelResult: FeelingResult,
  buffer: WriteBuffer,
  tickId?: string
): Promise<ActResult> {
  const { decision } = deliberateResult
  let responseSent = false
  let responseText: string | undefined
  let interrupted = false

  const routineHandlesMessaging = decision.action === "morning" || decision.action === "dream"
  if (decision.messages.length > 0 && !routineHandlesMessaging) {
    const messagingResult = await trySafe("TELEGRAM_ERROR", () =>
      sendMessages(decision, {
        emotion: feelResult.emotion,
        soma: feelResult.soma,
        vulnerabilityOpen: feelResult.vulnerability.windowOpen
      })
    )
    if (messagingResult.isOk()) {
      responseSent = messagingResult.value.responseSent
      responseText = messagingResult.value.responseText
      interrupted = messagingResult.value.interrupted
    } else {
      logAndCaptureError(messagingResult.error, { phase: "act_messaging" })
    }

    if (responseSent && decision.corrections.length > 0) {
      await decision.corrections.reduce(async (prev, correction) => {
        await prev
        await sleep(MESSAGE_DELAY.MIN_BETWEEN_MESSAGES_MS + Math.random() * MESSAGE_DELAY.MAX_JITTER_MS)
        await trySafe("TELEGRAM_ERROR", () => sendMessageWithReply(correction.text, correction.replyTo))
      }, Promise.resolve())
    }
  }

  await executeAction(deliberateResult, feelResult)

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

  let postActEmotion: EmotionalState | undefined
  if (responseSent) {
    const outcomeEmotion = computeEmotionalUpdate(feelResult.emotion, [
      { trigger: "message_sent", intensity: TRIGGER_INTENSITY.MESSAGE_SENT }
    ])
    postActEmotion = outcomeEmotion
    buffer.stage("working:emotion:current", outcomeEmotion)
    buffer.stagePostgres(emotionHistory, {
      state: outcomeEmotion,
      trigger: "message_sent",
      tickId: tickId ?? null
    })

    const drainedSoma = drainSocialBattery(
      feelResult.soma,
      decision.messages.length,
      senseResult.pendingMessages.length
    )
    const postActionSoma = computeSomaticUpdate({
      current: drainedSoma,
      emotion: outcomeEmotion,
      elapsedMinutes: 0,
      hourOfDay: getHours(nowLocal())
    })
    buffer.stage("working:soma:current", postActionSoma)
    buffer.stage("working:soma:lastTimestamp", new Date().toISOString())
    buffer.stagePostgres(somaticHistory, {
      state: postActionSoma,
      trigger: "post_action"
    })

    await recordActiveTick()
  }

  if (responseSent && responseText && tickId) {
    const hour = getHours(nowLocal())
    const timeOfDay = hour < 6 ? "night" : hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"

    const strategy: InteractionStrategy = {
      register: feelResult.register,
      emotionSummary: summarizeEmotions(feelResult.emotion),
      dominantDrive: feelResult.driveState.dominantDrive,
      timeOfDay: timeOfDay as InteractionStrategy["timeOfDay"],
      topicHint: responseText.slice(0, 50)
    }

    const activeConv = await getActiveConversation()
    await trySafe("COGNITION_ERROR", () => createOutcome(tickId, activeConv?.id ?? null, strategy, responseText))
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
  buffer.stage("working:psyche:current", updatedConcept)

  const growthArc = detectGrowthArc(updatedConcept, feelResult.selfConcept, nowISO())
  if (growthArc) {
    const existingArcs = await getGrowthArcs()
    buffer.stage("working:psyche:growthArcs", [...existingArcs, growthArc].slice(-10))
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
      buffer.stagePostgres(narrativeEntries, {
        content: entry.content,
        emotionalColoring: entry.emotionalColoring,
        significance: entry.significance
      })

      const existingNarratives = await getRecentNarratives()
      buffer.stage("working:psyche:recentNarratives", [...existingNarratives, entry].slice(-5))

      const narrativeSummary = buildNarrativeSummary([entry])
      buffer.stage("working:psyche:current", updatedConcept)
      buffer.stage("working:psyche:aspirations", [])
      buffer.stage("working:psyche:fears", [])
      buffer.stage("working:psyche:narrativeSummary", narrativeSummary)
      buffer.stagePostgres(psycheSnapshots, {
        selfConcept: updatedConcept,
        aspirations: [],
        fears: [],
        narrativeSummary
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

  return { responseSent, responseText, actionExecuted: decision.action, interrupted, postActEmotion }
}

async function executeAction(deliberateResult: DeliberateResult, feelResult: FeelingResult): Promise<void> {
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
      const { lifeEventType, lifeEventDetail, lifeEventDurationHours, alteredEventType } = decision.actionPayload ?? {}
      if (lifeEventType) {
        await startChosenLifeEvent(lifeEventType, lifeEventDetail, lifeEventDurationHours)
        if (alteredEventType) {
          await startAlteredState(alteredEventType, lifeEventType)
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

    case "create": {
      const creativeResult = await trySafe("CREATIVITY_ERROR", () =>
        generateCreativeOutput(feelResult.creativeUrge, summarizeEmotions(feelResult.emotion))
      )
      if (creativeResult.isErr()) {
        logAndCaptureError(creativeResult.error, { phase: "act_create" })
      } else if (creativeResult.value) {
        await storeEpisode(`Creative expression: ${creativeResult.value.slice(0, 500)}`, "observation", {
          relevanceScore: 0.7,
          valence: computeValence(feelResult.emotion)
        })
        log.info("Creative output generated", { mode: feelResult.creativeUrge.preferredMode })
      }
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
