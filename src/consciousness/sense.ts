import { differenceInMinutes, differenceInSeconds, parseISO } from "date-fns"
import { detectConversationBoundary } from "@/communication/conversation.ts"
import { HEALTH_CHECK_INTERVAL, HEARTBEAT } from "@/config/constants.ts"
import { analyzeMessageSentiment } from "@/emotion/analyze.ts"
import { getEmotionalState } from "@/emotion/state.ts"
import type { EmotionUpdateEvent, MoodContext } from "@/emotion/types.ts"
import { collectHealthStatus } from "@/health/check.ts"
import { fetchNewMessages } from "@/integrations/telegram.ts"
import { log } from "@/lib/logger.ts"
import { nowISO } from "@/lib/time.ts"
import { getActiveGoals } from "@/memory/goals.ts"
import {
  clearOperatorSilentFlag,
  getActiveConversation,
  getConversationWaitingSince,
  getDreamState,
  getFirstInteractionAt,
  getHealthCheck,
  getLastEmotionTimestamp,
  getOperatorSilentFlag,
  getTriggerTimestamps,
  incrementTotalInteractions,
  pushToActiveConversation,
  setConversationWaitingSince,
  setFirstInteractionAt,
  setHealthCheck,
  setLastUpdateId,
  setOperatorLastActivity,
  setPerceptionSummary,
  startNewConversation
} from "@/memory/working.ts"
import { readGitActivity, readOwnState, readTelegramActivity, readWeatherData } from "@/perception/sensors.ts"
import type { PerceptionSummary } from "@/perception/types.ts"
import { checkWorkflowTriggers, getActiveWorkflows, getRecentTickSummaries } from "@/workflow/engine.ts"
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
        const isNew = detectConversationBoundary(activeSlot, new Date(firstMsg.date * 1000).toISOString())
        if (isNew) {
          await startNewConversation()
        }
      }
    } else {
      await startNewConversation()
    }

    await pushToActiveConversation(
      newMessages.map((m) => ({
        role: "operator" as const,
        text: m.text,
        timestamp: new Date(m.date * 1000).toISOString(),
        messageId: m.messageId ?? 0,
        isVoice: m.isVoice || undefined
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
      health = await collectHealthStatus()
      await setHealthCheck(health)
    } catch (e) {
      log.warn("Health check failed during sense", { error: String(e) })
    }
  }

  const allTriggers: EmotionUpdateEvent[] = [
    ...ownState.triggers,
    ...telegramActivity.triggers,
    ...weatherResult.triggers,
    ...gitActivity.triggers,
    ...(newMessages.length > 0
      ? await (async () => {
          const sentimentResult = await analyzeMessageSentiment(newMessages)
          if (sentimentResult.isOk()) return sentimentResult.value
          return [
            { trigger: "message_received" as const, intensity: 0.6, detail: `${newMessages.length} new message(s)` }
          ]
        })()
      : [])
  ]

  if (newMessages.length > 0) {
    const wasSilent = await getOperatorSilentFlag()
    if (wasSilent) {
      allTriggers.push({ trigger: "operator_returned", intensity: 0.7, detail: "Operator returned after silence" })
      await clearOperatorSilentFlag()
    }
  }

  const [lastEmotionTs, triggerTimestamps, activeGoals, dreamState] = await Promise.all([
    getLastEmotionTimestamp(),
    getTriggerTimestamps(),
    getActiveGoals(),
    getDreamState()
  ])

  const elapsedMinutes = lastEmotionTs ? differenceInMinutes(new Date(), parseISO(lastEmotionTs)) : 1

  const moodContext: MoodContext = {
    operatorSilenceMinutes: telegramActivity.lastMessageAge > 0 ? telegramActivity.lastMessageAge / 60 : 0,
    inConversation: waitingSince != null,
    systemHealthy: ownState.healthStatus === "healthy",
    budgetOk: ownState.budgetPercent < 80,
    hasActiveGoals: activeGoals.length > 0,
    isDreaming: dreamState === "dreaming"
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
    const currentEmotion = await getEmotionalState()
    triggeredWorkflows = await checkWorkflowTriggers(activeWorkflows, currentEmotion, perception, recentActions)
  } else {
    triggeredWorkflows = []
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
