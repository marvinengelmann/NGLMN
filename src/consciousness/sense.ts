import { differenceInSeconds, parseISO } from "date-fns"
import { detectConversationBoundary } from "@/communication/conversation.ts"
import { HEALTH_CHECK_INTERVAL, HEARTBEAT } from "@/config/constants.ts"
import { getEmotionalState, saveEmotionalState } from "@/emotion/state.ts"
import type { EmotionUpdateEvent } from "@/emotion/types.ts"
import { computeEmotionalUpdate } from "@/emotion/update.ts"
import { collectHealthStatus } from "@/health/check.ts"
import { fetchNewMessages } from "@/integrations/telegram.ts"
import { log } from "@/lib/logger.ts"
import { setEmotionContext } from "@/lib/sentry.ts"
import { nowISO } from "@/lib/time.ts"
import {
  getActiveConversation,
  getConversationWaitingSince,
  getHealthCheck,
  pushToActiveConversation,
  setConversationWaitingSince,
  setHealthCheck,
  setLastUpdateId,
  setOperatorLastActivity,
  setPerceptionSummary,
  startNewConversation
} from "@/memory/working.ts"
import { readGitActivity, readOwnState, readTelegramActivity, readWeatherData } from "@/perception/sensors.ts"
import type { PerceptionSummary } from "@/perception/types.ts"
import { checkWorkflowTriggers, getActiveWorkflows, getRecentTickSummaries } from "@/workflow/engine.ts"
import { buildContext, buildSystemPrompt } from "./context.ts"
import type { ConversationState, SenseData, SenseResult } from "./types.ts"

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
        messageId: m.messageId ?? 0
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
    { trigger: "tick_start", intensity: 0.5 },
    ...ownState.triggers,
    ...telegramActivity.triggers,
    ...weatherResult.triggers,
    ...gitActivity.triggers,
    ...(newMessages.length > 0
      ? [{ trigger: "message_received" as const, intensity: 0.6, detail: `${newMessages.length} new message(s)` }]
      : [])
  ]

  const currentEmotion = await getEmotionalState()
  const updatedEmotion = computeEmotionalUpdate(currentEmotion, allTriggers)
  await saveEmotionalState(updatedEmotion, "tick_start")
  setEmotionContext(updatedEmotion)

  const perception: PerceptionSummary = {
    timestamp: nowISO(),
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
    triggeredWorkflows = await checkWorkflowTriggers(activeWorkflows, updatedEmotion, perception, recentActions)
  } else {
    triggeredWorkflows = []
  }

  const senseData: SenseData = {
    pendingMessages: newMessages,
    perception,
    emotion: updatedEmotion,
    health,
    weather: weatherResult.weatherData,
    conversationState,
    triggeredWorkflows
  }

  const contextString = await buildContext(senseData)
  const systemPrompt = buildSystemPrompt(contextString)

  log.info("Sense completed", {
    messages: newMessages.length,
    health: ownState.healthStatus,
    triggers: allTriggers.length,
    conversationState,
    triggeredWorkflows: triggeredWorkflows.length
  })

  return {
    systemPrompt,
    userPrompt: "Process your current perception and decide what to do.",
    pendingMessages: newMessages,
    perception,
    emotion: updatedEmotion,
    health,
    conversationState,
    triggeredWorkflows
  }
}
