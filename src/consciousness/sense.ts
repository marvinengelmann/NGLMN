import { differenceInMinutes, differenceInSeconds, formatISO, fromUnixTime, parseISO } from "date-fns"
import { analyzeMessageSentiment } from "@/affect/emotion/analyze.ts"
import { TRIGGER_INTENSITY } from "@/affect/emotion/constants.ts"
import { getEmotionalState, getLastEmotionTimestamp, getTriggerTimestamps } from "@/affect/emotion/state.ts"
import type { EmotionUpdateEvent, MoodContext } from "@/affect/emotion/types.ts"
import { getUnresolvedOutcome, resolveOutcome } from "@/cognition/learning/outcomes.ts"
import { reinforceInsight } from "@/cognition/learning/reinforce.ts"
import type { OperatorReaction } from "@/cognition/learning/types.ts"
import { archiveConversation, detectConversationBoundary } from "@/expression/communication/conversation.ts"
import {
  getActiveConversation,
  getConversationWaitingSince,
  pushToActiveConversation,
  setConversationWaitingSince,
  startNewConversation
} from "@/expression/communication/state.ts"
import { getDreamState } from "@/expression/dream/state.ts"
import { runHealthCheck } from "@/governance/health/check.ts"
import { getHealthCheck } from "@/governance/health/state.ts"
import { checkWorkflowTriggers, getActiveWorkflows, getRecentTickSummaries } from "@/governance/workflow/engine.ts"
import { HEALTH_CHECK_INTERVAL, HEARTBEAT } from "@/infra/config/constants.ts"
import { fetchNewMessages } from "@/infra/integrations/telegram.ts"
import { log } from "@/infra/lib/logger.ts"
import { clamp } from "@/infra/lib/math.ts"
import { trySafe } from "@/infra/lib/result.ts"
import { nowISO } from "@/infra/lib/time.ts"
import { getActiveGoals } from "@/memory/goals.ts"
import { getKnowledge } from "@/memory/semantic.ts"
import { setLastUpdateId } from "@/memory/working.ts"
import { detectPerceptionGoals } from "@/perception/goals.ts"
import { readGitActivity, readOwnState, readTelegramActivity, readWeatherData } from "@/perception/sensors.ts"
import {
  clearOperatorSilentFlag,
  getOperatorSilentFlag,
  setOperatorLastActivity,
  setPerceptionSummary
} from "@/perception/state.ts"
import type { PerceptionSummary } from "@/perception/types.ts"
import {
  getAttachmentStyle,
  getFirstInteractionAt,
  incrementTotalInteractions,
  setFirstInteractionAt
} from "@/relational/attachment/state.ts"
import { getOperatorModel, getRelationalPatterns } from "@/relational/mind/state.ts"
import { extractSignals, matchRelationalPatterns } from "@/relational/mind/triggers.ts"
import type { ConversationState, SenseResult } from "./types.ts"

/**
 * SENSE phase — pure perception, no processing or decisions.
 * Gathers all raw data, builds context and prompts for THINK.
 */
export async function sense(): Promise<SenseResult> {
  const waitingSince = await getConversationWaitingSince()
  const inConversation = waitingSince != null
  const timeout = inConversation ? HEARTBEAT.CONVERSATION_POLL_TIMEOUT : 0
  const { messages: newMessages, maxUpdateId } = await fetchNewMessages(timeout)

  if (maxUpdateId != null) {
    await setLastUpdateId(maxUpdateId)
  }

  if (newMessages.length > 0) {
    await incrementTotalInteractions()
    const firstAt = await getFirstInteractionAt()
    if (!firstAt) await setFirstInteractionAt(nowISO())
    await setOperatorLastActivity(nowISO())
    if (inConversation) await setConversationWaitingSince(nowISO())

    const activeSlot = await getActiveConversation()
    if (activeSlot) {
      const firstMsg = newMessages[0]
      if (firstMsg) {
        const isNew = detectConversationBoundary(activeSlot, formatISO(fromUnixTime(firstMsg.date)))
        if (isNew) {
          if (activeSlot.messages.length > 0) {
            const emotionForArchive = await getEmotionalState()
            await trySafe("ARCHIVE_ERROR", () => archiveConversation(activeSlot, emotionForArchive))
          }
          await startNewConversation()
        }
      }
    } else {
      await startNewConversation()
    }

    await pushToActiveConversation(
      newMessages.map((m) => ({
        role: "operator" as const,
        text: m.text || (m.image ? "[Photo]" : ""),
        timestamp: formatISO(fromUnixTime(m.date)),
        messageId: m.messageId ?? 0,
        isVoice: m.isVoice || undefined,
        hasImage: m.image ? true : undefined
      }))
    )
  }

  const [ownState, telegramActivity, weatherResult, gitActivity] = await Promise.all([
    readOwnState(),
    readTelegramActivity(),
    readWeatherData(),
    readGitActivity()
  ])

  let health = await getHealthCheck()
  if (!health || differenceInSeconds(new Date(), parseISO(health.timestamp)) > HEALTH_CHECK_INTERVAL) {
    try {
      health = await runHealthCheck()
    } catch (e) {
      log.warn("Health check failed during sense", { error: String(e) })
    }
  }

  let lastSentiment: "positive" | "negative" | "neutral" | "mixed" = "neutral"

  const allTriggers: EmotionUpdateEvent[] = [
    ...ownState.triggers,
    ...telegramActivity.triggers,
    ...weatherResult.triggers,
    ...gitActivity.triggers,
    ...(newMessages.length > 0
      ? await (async () => {
          const sentimentResult = await analyzeMessageSentiment(newMessages)
          if (sentimentResult.isOk()) {
            lastSentiment = sentimentResult.value.dominantSentiment
            return sentimentResult.value.triggers
          }
          return [
            {
              trigger: "message_received" as const,
              intensity: TRIGGER_INTENSITY.MESSAGE_RECEIVED,
              detail: `${newMessages.length} new message(s)`
            }
          ]
        })()
      : [])
  ]

  if (newMessages.length > 0) {
    const unresolvedOutcome = await getUnresolvedOutcome()
    if (unresolvedOutcome) {
      const minutesSinceOutcome = differenceInMinutes(new Date(), new Date(unresolvedOutcome.createdAt))
      const avgMessageLength = newMessages.reduce((sum, m) => sum + (m.text?.length ?? 0), 0) / newMessages.length
      const baselineLength = 40
      const engagementDelta = clamp((avgMessageLength - baselineLength) / baselineLength, -1, 1)

      const reaction: OperatorReaction = {
        repliedWithinMinutes: minutesSinceOutcome,
        sentiment: lastSentiment,
        engagementDelta,
        conversationContinued: newMessages.length > 1
      }

      const outcomeScore = await resolveOutcome(unresolvedOutcome.id, reaction)

      const insightsResult = await getKnowledge({ category: "insight", scope: "self", limit: 3 })
      if (insightsResult.isOk()) {
        insightsResult.value.forEach((insight) => {
          reinforceInsight(insight.id, outcomeScore).catch((e) =>
            log.warn("Insight reinforcement failed", { insightId: insight.id, error: String(e) })
          )
        })
      }
    }
  }

  let shouldClearSilentFlag = false
  if (newMessages.length > 0) {
    const wasSilent = await getOperatorSilentFlag()
    if (wasSilent) {
      allTriggers.push({
        trigger: "operator_returned",
        intensity: TRIGGER_INTENSITY.OPERATOR_RETURNED,
        detail: "Operator returned after silence"
      })
      shouldClearSilentFlag = true
    }
  }

  const [
    lastEmotionTs,
    triggerTimestamps,
    activeGoals,
    dreamState,
    operatorModel,
    currentEmotion,
    attachmentStyle,
    relationalPatterns
  ] = await Promise.all([
    getLastEmotionTimestamp(),
    getTriggerTimestamps(),
    getActiveGoals(),
    getDreamState(),
    getOperatorModel(),
    getEmotionalState(),
    getAttachmentStyle(),
    getRelationalPatterns()
  ])

  if (newMessages.length > 0) {
    const messageTexts = newMessages.map((m) => m.text)
    const signals = extractSignals(messageTexts)
    const relationalTriggers = matchRelationalPatterns(signals, operatorModel, relationalPatterns)
    allTriggers.push(...relationalTriggers)
  }

  const elapsedMinutes = lastEmotionTs ? differenceInMinutes(new Date(), parseISO(lastEmotionTs)) : 1

  const moodContext: MoodContext = {
    operatorSilenceMinutes: telegramActivity.lastMessageAge > 0 ? telegramActivity.lastMessageAge / 60 : 60,
    inConversation: waitingSince != null,
    systemHealthy: ownState.healthStatus === "healthy",
    budgetOk: ownState.budgetPercent < 80,
    hasActiveGoals: activeGoals.length > 0,
    isDreaming: dreamState === "dreaming",
    operatorMood: operatorModel.estimatedMood,
    connectionLevel: currentEmotion.connection,
    attachmentAvoidance: attachmentStyle.avoidant
  }

  const now = nowISO()

  const perception: PerceptionSummary = {
    timestamp: now,
    ownState: {
      budgetPercent: ownState.budgetPercent,
      lastTickAge: ownState.lastTickAge,
      errorCount: ownState.errorCount,
      healthStatus: ownState.healthStatus
    },
    telegramActivity: {
      pendingCount: newMessages.length,
      lastMessageAge: telegramActivity.lastMessageAge,
      operatorActive: telegramActivity.operatorActive
    },
    weatherData: weatherResult.weatherData ?? undefined,
    gitActivity:
      gitActivity.recentCommits.length > 0
        ? {
            recentCommits: gitActivity.recentCommits,
            selfCommitCount: gitActivity.selfCommitCount,
            externalCommitCount: gitActivity.externalCommitCount
          }
        : undefined,
    emotionalTriggers: allTriggers
  }
  await setPerceptionSummary(perception)

  detectPerceptionGoals(perception, currentEmotion).catch((e) =>
    log.warn("Perception goal detection failed", { error: String(e) })
  )

  let conversationState: ConversationState | null = null
  if (inConversation && waitingSince) {
    conversationState = {
      waitingSeconds: differenceInSeconds(new Date(), parseISO(waitingSince)),
      replyReceived: newMessages.length > 0
    }
  }

  const activeWorkflows = await getActiveWorkflows()
  let triggeredWorkflows = activeWorkflows
  if (activeWorkflows.length > 0) {
    const recentTicks = await getRecentTickSummaries(50)
    const recentActions = recentTicks.map((t) => t.action)
    triggeredWorkflows = await checkWorkflowTriggers(activeWorkflows, currentEmotion, perception, recentActions)
  } else {
    triggeredWorkflows = []
  }

  if (shouldClearSilentFlag) {
    await clearOperatorSilentFlag()
  }

  log.info("Sense completed", {
    messages: newMessages.length,
    health: ownState.healthStatus,
    triggers: allTriggers.length,
    conversationState,
    triggeredWorkflows: triggeredWorkflows.length
  })

  return {
    pendingMessages: newMessages,
    perception,
    health,
    conversationState,
    triggeredWorkflows,
    moodContext,
    rawTriggers: allTriggers,
    elapsedMinutes,
    triggerTimestamps
  }
}
