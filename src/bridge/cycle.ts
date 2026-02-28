import { formatISO } from "date-fns"
import { checkForAfterthought } from "@/bridge/afterthought.ts"
import { archiveConversation, detectConversationBoundary, recallArchivedContext } from "@/bridge/conversation.ts"
import { buildConversationResponsePrompt, computeFollowUpWait } from "@/bridge/handler.ts"
import { StructuredResponse } from "@/bridge/types.ts"
import {
  computeInterParagraphPause,
  computeReadTime,
  computeThinkingDuration,
  computeTypingDuration,
  simulateTyping,
  splitIntoParagraphs
} from "@/bridge/typing.ts"
import { AFTERTHOUGHT, CONVERSATION, EMOTIONAL_THRESHOLDS, HUMAN_BRIDGE, MESSAGE_DELAY } from "@/config/constants.ts"
import { buildConsciousnessPrompt } from "@/core/consciousness.ts"
import { callIntelligence, FAST, getMaxTokensForTier, selectModel } from "@/core/intelligence.ts"
import { TriageResult } from "@/core/types.ts"
import { getEmotionalState, processEmotionTrigger, saveEmotionalState } from "@/emotion/state.ts"
import { computeEmotionalUpdate } from "@/emotion/update.ts"
import { loadPrompt } from "@/evolution/prompt.ts"
import { fetchNewMessages, sendMessageWithReply, sendTypingAction } from "@/integrations/telegram.ts"
import { log } from "@/lib/logger.ts"
import { nowISO, sleep } from "@/lib/time.ts"
import { storeEpisode, storeRelationshipEpisode } from "@/memory/episodic.ts"
import { getOperatorLanguage } from "@/memory/semantic.ts"
import {
  getActiveConversation,
  getConversationBuffer,
  pushRecentResponse,
  pushToActiveConversation,
  setLastUpdateId,
  setOperatorLastActivity,
  startNewConversation
} from "@/memory/working.ts"
import { CONVERSATION_TRIAGE_SYSTEM_PROMPT } from "@/prompts/conversation.ts"
import { RESPONDER_SYSTEM_PROMPT } from "@/prompts/responder.ts"

interface IncomingMessage {
  updateId: number
  chatId: number
  from: string
  text: string
  date: number
  messageId?: number
  replyToText?: string
}

/**
 * Runs the full bridge cycle: polls Telegram for new messages, tracks activity,
 * and hands off to the conversation loop.
 */
export async function runBridgeCycle(): Promise<{ rounds: number }> {
  const initialPoll = await fetchNewMessages(HUMAN_BRIDGE.INITIAL_TIMEOUT)

  if (initialPoll.messages.length === 0) {
    log.info("Bridge: no messages after initial poll")
    return { rounds: 0 }
  }

  if (initialPoll.maxUpdateId != null) {
    await setLastUpdateId(initialPoll.maxUpdateId)
  }
  await setOperatorLastActivity(nowISO())

  return runConversationLoop(initialPoll.messages)
}

export async function runConversationLoop(initialMessages: IncomingMessage[]): Promise<{ rounds: number }> {
  let messages = initialMessages
  let roundCount = 0

  while (roundCount < CONVERSATION.MAX_ROUNDS) {
    roundCount++

    const activeSlot = await getActiveConversation()

    if (activeSlot && activeSlot.messages.length > 0) {
      const boundary = await detectConversationBoundary(activeSlot, messages)
      if (boundary.isNewConversation) {
        log.info("New conversation detected", { reason: boundary.reason })
        const emotion = await getEmotionalState()
        const evicted = await startNewConversation()
        if (evicted) {
          log.info("Buffer full, archiving oldest conversation", {
            slotId: evicted.id,
            messageCount: evicted.messages.length
          })
          await archiveConversation(evicted.messages, emotion)
        }
      }
    } else if (!activeSlot) {
      await startNewConversation()
    }

    await pushToActiveConversation(
      messages.map((message) => ({
        role: "operator" as const,
        text: message.text,
        timestamp: formatISO(new Date(message.date * 1000)),
        messageId: message.messageId ?? 0
      }))
    )

    await processEmotionTrigger(
      { trigger: "message_received", intensity: EMOTIONAL_THRESHOLDS.MESSAGE_RECEIVED_INTENSITY },
      "message_received",
      `conv-${Date.now()}`
    )

    let recalledContext: string | null = null
    const replyMessages = messages.filter((message) => message.replyToText)
    if (replyMessages.length > 0) {
      const buffer = await getConversationBuffer()
      for (const replyMessage of replyMessages) {
        if (replyMessage.replyToText) {
          recalledContext = await recallArchivedContext(replyMessage.replyToText, buffer)
          if (recalledContext) {
            log.info("Recalled archived context for reply", {
              replyToText: replyMessage.replyToText.slice(0, 100)
            })
            break
          }
        }
      }
    }

    const buffer = await getConversationBuffer()
    const historyLines: string[] = []
    for (const slot of buffer) {
      for (const entry of slot.messages) {
        const idPrefix = entry.messageId ? `[#${entry.messageId}] ` : ""
        historyLines.push(`${idPrefix}[${entry.role === "operator" ? "Operator" : "ANIMA"}]: ${entry.text}`)
      }
    }
    const historyBlock = historyLines.length > 0 ? historyLines.join("\n") : null

    const messagesBlock = messages
      .map((message) => {
        const idPrefix = message.messageId ? `[#${message.messageId}] ` : ""
        const replyPrefix = message.replyToText ? `(replying to: "${message.replyToText.slice(0, 200)}") ` : ""
        return `${idPrefix}[Operator]: ${replyPrefix}${message.text}`
      })
      .join("\n")

    const triageUserMessage = historyBlock
      ? `Conversation history:\n${historyBlock}\n\nNew messages (${messages.length}):\n${messagesBlock}`
      : `New messages (${messages.length}):\n${messagesBlock}`

    const triagePrompt = await loadPrompt("conversation-triage", CONVERSATION_TRIAGE_SYSTEM_PROMPT)
    const triageCallResult = await callIntelligence({
      model: FAST,
      system: triagePrompt,
      userMessage: triageUserMessage,
      schema: TriageResult,
      maxTokens: getMaxTokensForTier("triage")
    })

    if (triageCallResult.isErr()) {
      log.warn("Triage call failed", { error: triageCallResult.error.message })
      break
    }

    const triageResult = triageCallResult.value

    const emotion = await getEmotionalState()

    if (triageResult.decision === "idle") {
      log.info("Triage decided no response needed", { reason: triageResult.reason })
      await storeEpisode(
        `Received ${messages.length} message(s) but chose not to respond: ${triageResult.reason}`,
        "interaction",
        { relevanceScore: triageResult.confidence }
      )
      break
    }

    const tier = triageResult.decision
    const model = selectModel(triageResult)
    const consciousnessPrompt = await buildConsciousnessPrompt(emotion)

    const contextPrompt = await buildConversationResponsePrompt(messages, consciousnessPrompt, tier, recalledContext)

    const responderPrompt = await loadPrompt("responder", RESPONDER_SYSTEM_PROMPT)
    const responderCallResult = await callIntelligence({
      model,
      system: responderPrompt,
      userMessage: contextPrompt,
      schema: StructuredResponse,
      maxTokens: getMaxTokensForTier(tier)
    })

    if (responderCallResult.isErr()) {
      log.warn("Responder call failed", { error: responderCallResult.error.message })
      await storeEpisode(
        `Received ${messages.length} message(s) but responder failed: ${responderCallResult.error.message}`,
        "interaction",
        { relevanceScore: 0.3 }
      )
      break
    }

    const structuredResponse = responderCallResult.value
    log.info("Parsed structured response", {
      messageCount: structuredResponse.messages.length,
      expectsReply: structuredResponse.expectsReply
    })

    const readTime = computeReadTime(messages)
    await sleep(readTime)

    const thinkingTime = computeThinkingDuration(tier)
    await sleep(thinkingTime)

    for (const [i, responseMessage] of structuredResponse.messages.entries()) {
      const paragraphs = splitIntoParagraphs(responseMessage.text)

      for (const [p, paragraph] of paragraphs.entries()) {
        await simulateTyping(computeTypingDuration(paragraph), sendTypingAction)
        const sentMessageId = await sendMessageWithReply(paragraph, p === 0 ? responseMessage.replyTo : undefined)

        await pushToActiveConversation([
          { role: "anima", text: paragraph, timestamp: nowISO(), messageId: sentMessageId }
        ])
        await pushRecentResponse(paragraph)

        if (p < paragraphs.length - 1) {
          await sleep(computeInterParagraphPause())
        }
      }

      if (i < structuredResponse.messages.length - 1) {
        await sleep(MESSAGE_DELAY.MIN_BETWEEN_MESSAGES_MS + Math.random() * MESSAGE_DELAY.MAX_JITTER_MS)
      }
    }

    const afterthoughtPause =
      AFTERTHOUGHT.PAUSE_MIN_MS + Math.random() * (AFTERTHOUGHT.PAUSE_MAX_MS - AFTERTHOUGHT.PAUSE_MIN_MS)
    await sleep(afterthoughtPause)

    const operatorLanguage = await getOperatorLanguage()
    const afterthoughtBuffer = await getConversationBuffer()
    const afterthought = await checkForAfterthought(afterthoughtBuffer, consciousnessPrompt, operatorLanguage)

    if (afterthought) {
      const atThinkingTime = computeThinkingDuration("simple")
      await sleep(atThinkingTime)

      const atParagraphs = splitIntoParagraphs(afterthought.text)
      for (const [p, paragraph] of atParagraphs.entries()) {
        await simulateTyping(computeTypingDuration(paragraph), sendTypingAction)
        const atSentId = await sendMessageWithReply(paragraph, p === 0 ? afterthought.replyTo : undefined)

        await pushToActiveConversation([{ role: "anima", text: paragraph, timestamp: nowISO(), messageId: atSentId }])
        await pushRecentResponse(paragraph)

        if (p < atParagraphs.length - 1) {
          await sleep(computeInterParagraphPause())
        }
      }

      await storeEpisode(`Afterthought: ${afterthought.text.slice(0, 200)}`, "interaction", {
        relevanceScore: 0.5
      })
      log.info("Afterthought sent", { textLength: afterthought.text.length })
    }

    const updatedEmotion = computeEmotionalUpdate(emotion, [
      { trigger: "message_sent", intensity: EMOTIONAL_THRESHOLDS.MESSAGE_SENT_INTENSITY },
      { trigger: "task_success", intensity: EMOTIONAL_THRESHOLDS.TASK_SUCCESS_INTENSITY }
    ])
    await saveEmotionalState(updatedEmotion, "message_sent", `conv-${Date.now()}`)

    const episodeSummary = `Responded to ${messages.length} message(s) via bridge (${tier} tier)`

    if (updatedEmotion.connection > EMOTIONAL_THRESHOLDS.CONNECTION_HIGH) {
      await storeRelationshipEpisode(episodeSummary)
    } else {
      await storeEpisode(episodeSummary, "interaction", {
        relevanceScore: triageResult.confidence
      })
    }

    if (structuredResponse.actionRequested) {
      log.info("Action requested by operator, triggering heartbeat")
      const { heartbeatRunTask } = await import("@/trigger/heartbeat.ts")
      await heartbeatRunTask.trigger({ skipDreamCheck: true, actionRequested: true })
    }

    log.info("Conversation round complete", {
      round: roundCount,
      messagesProcessed: messages.length,
      responsesSent: structuredResponse.messages.length,
      tier,
      model
    })

    if (!structuredResponse.expectsReply) {
      log.info("Response does not expect reply, ending conversation")
      break
    }

    const followUpTimeout = computeFollowUpWait(updatedEmotion)
    const followUpPoll = await fetchNewMessages(followUpTimeout)

    if (followUpPoll.messages.length === 0) {
      log.info("Follow-up poll timed out, ending conversation", { waitSeconds: followUpTimeout })
      break
    }

    messages = followUpPoll.messages
    if (followUpPoll.maxUpdateId != null) {
      await setLastUpdateId(followUpPoll.maxUpdateId)
    }
    await setOperatorLastActivity(nowISO())

    await processEmotionTrigger(
      { trigger: "message_received", intensity: EMOTIONAL_THRESHOLDS.MESSAGE_RECEIVED_INTENSITY },
      "message_received",
      `conv-${Date.now()}`
    )

    log.info("Follow-up messages received, continuing conversation", { count: messages.length })
  }

  if (roundCount >= CONVERSATION.MAX_ROUNDS) {
    log.warn("Conversation hit max rounds limit", { rounds: roundCount })
  }

  log.info("Bridge finished", { rounds: roundCount })
  return { rounds: roundCount }
}
