import { task, wait } from "@trigger.dev/sdk"
import { formatISO } from "date-fns"
import { jsonrepair } from "jsonrepair"
import { archiveConversation, detectConversationBoundary, recallArchivedContext } from "@/bridge/conversation.ts"
import { buildConversationResponsePrompt, computeFollowUpWait, parseStructuredResponse } from "@/bridge/handler.ts"
import { computeReadTime, computeTypingDuration, simulateTyping } from "@/bridge/typing.ts"
import { CONVERSATION, EMOTIONAL_THRESHOLDS, MESSAGE_DELAY, TRIAGE_DEFAULTS } from "@/config/constants.ts"
import { getMaxTokensForTier, selectModel } from "@/core/model-router.ts"
import { TriageResult } from "@/core/types.ts"
import { getEmotionalState, saveEmotionalState } from "@/emotion/state.ts"
import { computeEmotionalUpdate } from "@/emotion/update.ts"
import { loadPrompt } from "@/evolution/prompt-loader.ts"
import { callClaude, callClaudeWithUsage, HAIKU } from "@/integrations/anthropic.ts"
import { sendMessageWithReply, sendTypingAction } from "@/integrations/telegram.ts"
import { log } from "@/lib/logger.ts"
import { addBreadcrumb } from "@/lib/sentry.ts"
import { sleep } from "@/lib/time.ts"
import { storeEpisode, storeRelationshipEpisode } from "@/memory/episodic.ts"
import {
  clearConversationWaitToken,
  clearProcessedMessages,
  getActiveConversation,
  getConversationBuffer,
  peekAllPendingMessages,
  pushRecentResponse,
  pushToActiveConversation,
  setConversationWaitToken,
  setGuardianResult,
  startNewConversation
} from "@/memory/working.ts"
import { getEffectivePersonality } from "@/personality/dna.ts"
import { buildPersonalityPrompt } from "@/personality/expression.ts"
import { getMbtiType } from "@/personality/mbti.ts"
import { CONVERSATION_TRIAGE_SYSTEM_PROMPT } from "@/prompts/conversation.ts"
import { RESPONDER_SYSTEM_PROMPT } from "@/prompts/responder.ts"
import { validateOutput } from "@/security/guardian.ts"
import type { ConversationHandlerPayload } from "@/trigger/types.ts"

/**
 * Dedicated conversation handler — manages all message-based interactions.
 * Supports multi-message structured responses, typing simulation,
 * reply-to specific messages, follow-up waiting, and a 3-slot conversation buffer.
 */
export const conversationHandlerTask = task({
  id: "conversation-handler",
  queue: {
    concurrencyLimit: 1
  },
  maxDuration: 300,
  run: async (payload: ConversationHandlerPayload) => {
    log.info("Conversation handler started", { reason: payload.triggerReason })

    let continueConversation = true
    let roundCount = 0

    while (continueConversation && roundCount < CONVERSATION.MAX_ROUNDS) {
      roundCount++

      const messages = await peekAllPendingMessages()
      if (messages.length === 0) {
        log.info("No pending messages, ending conversation handler")
        break
      }

      const activeSlot = await getActiveConversation()

      if (activeSlot && activeSlot.messages.length > 0) {
        const boundary = await detectConversationBoundary(activeSlot, messages)
        if (boundary.isNewConversation) {
          log.info("New conversation detected, starting new slot", { reason: boundary.reason })
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

      let recalledContext: string | null = null
      const replyMessages = messages.filter((m) => m.replyToText)
      if (replyMessages.length > 0) {
        const buffer = await getConversationBuffer()
        for (const msg of replyMessages) {
          if (msg.replyToText) {
            recalledContext = await recallArchivedContext(msg.replyToText, buffer)
            if (recalledContext) {
              log.info("Recalled archived context for reply", { replyToText: msg.replyToText.slice(0, 100) })
              break
            }
          }
        }
      }

      const buffer = await getConversationBuffer()
      const historyLines: string[] = []
      for (const slot of buffer) {
        for (const m of slot.messages) {
          historyLines.push(`[${m.role === "operator" ? "Operator" : "ANIMA"}]: ${m.text}`)
        }
      }
      const historyBlock = historyLines.length > 0 ? historyLines.join("\n") : null

      const messagesBlock = messages
        .map((m) => {
          const replyPrefix = m.replyToText ? `(replying to: "${m.replyToText.slice(0, 200)}") ` : ""
          return `[Operator]: ${replyPrefix}${m.text}`
        })
        .join("\n")

      const triageUserMessage = historyBlock
        ? `Conversation history:\n${historyBlock}\n\nNew messages (${messages.length}):\n${messagesBlock}`
        : `New messages (${messages.length}):\n${messagesBlock}`

      const triagePrompt = await loadPrompt("conversation-triage", CONVERSATION_TRIAGE_SYSTEM_PROMPT)
      const triageCallResult = await callClaude({
        model: HAIKU,
        system: triagePrompt,
        userMessage: triageUserMessage,
        maxTokens: getMaxTokensForTier("triage")
      })

      if (triageCallResult.isErr()) {
        log.warn("Triage call failed in conversation", { error: triageCallResult.error.message })
        break
      }
      const triageRaw = triageCallResult.value

      let triageResult: TriageResult
      try {
        triageResult = TriageResult.parse(JSON.parse(jsonrepair(triageRaw)))
      } catch {
        triageResult = {
          decision: "simple",
          reason: "triage parse error — responding to be safe",
          confidence: TRIAGE_DEFAULTS.FALLBACK_CONFIDENCE,
          estimatedTokens: TRIAGE_DEFAULTS.OVERRIDE_ESTIMATED_TOKENS
        }
      }

      const emotion = await getEmotionalState()

      if (triageResult.decision === "idle") {
        log.info("Triage decided no response needed", { reason: triageResult.reason })

        for (const msg of messages) {
          await pushToActiveConversation({
            role: "operator",
            text: msg.text,
            timestamp: formatISO(new Date(msg.date * 1000))
          })
        }
        await clearProcessedMessages(messages.length)

        await storeEpisode(
          `Received ${messages.length} message(s) but chose not to respond: ${triageResult.reason}`,
          "interaction",
          { relevanceScore: triageResult.confidence }
        )

        continueConversation = false
        continue
      }

      const tier = triageResult.decision
      const model = await selectModel(triageResult)
      const personality = await getEffectivePersonality()
      const personalityPrompt = buildPersonalityPrompt(personality, emotion, getMbtiType())

      const contextPrompt = await buildConversationResponsePrompt(messages, personalityPrompt, tier, recalledContext)

      const responderPrompt = await loadPrompt("responder", RESPONDER_SYSTEM_PROMPT)
      const responderCallResult = await callClaudeWithUsage({
        model,
        system: responderPrompt,
        userMessage: contextPrompt,
        maxTokens: getMaxTokensForTier(tier)
      })

      if (responderCallResult.isErr()) {
        log.warn("Responder call failed", { error: responderCallResult.error.message })
        await clearProcessedMessages(messages.length)
        break
      }
      const responderResponse = responderCallResult.value

      const structuredResponse = parseStructuredResponse(responderResponse.text)
      const responseMessages = structuredResponse.messages
      log.info("Parsed structured response", {
        messageCount: responseMessages.length,
        expectsReply: structuredResponse.expectsReply
      })

      const validatedMessages = []
      for (const msg of responseMessages) {
        const guardianResult = await validateOutput(msg.text)
        await setGuardianResult(guardianResult)

        if (guardianResult.verdict === "blocked") {
          log.warn("Guardian blocked message", { reasons: guardianResult.reasons })
          addBreadcrumb("guardian", "Blocked message in conversation", {
            verdict: "blocked",
            reasons: guardianResult.reasons
          })
          continue
        }

        if (guardianResult.verdict === "warning") {
          log.warn("Guardian warning on message", { reasons: guardianResult.reasons })
        }

        validatedMessages.push(msg)
      }

      if (validatedMessages.length === 0) {
        log.warn("All messages blocked by guardian")
        await clearProcessedMessages(messages.length)
        break
      }

      const readTime = computeReadTime(messages)
      await sleep(readTime)

      for (const msg of messages) {
        await pushToActiveConversation({
          role: "operator",
          text: msg.text,
          timestamp: formatISO(new Date(msg.date * 1000))
        })
      }

      for (let i = 0; i < validatedMessages.length; i++) {
        const msg = validatedMessages[i]
        if (!msg) continue

        await simulateTyping(computeTypingDuration(msg.text), sendTypingAction)

        await sendMessageWithReply(msg.text, msg.replyTo)

        await pushToActiveConversation({
          role: "anima",
          text: msg.text,
          timestamp: formatISO(new Date())
        })

        await pushRecentResponse(msg.text)

        if (i < validatedMessages.length - 1) {
          await sleep(MESSAGE_DELAY.MIN_BETWEEN_MESSAGES_MS + Math.random() * MESSAGE_DELAY.MAX_JITTER_MS)
        }
      }

      await clearProcessedMessages(messages.length)

      const updatedEmotion = computeEmotionalUpdate(emotion, [
        { trigger: "message_sent", intensity: EMOTIONAL_THRESHOLDS.MESSAGE_SENT_INTENSITY },
        { trigger: "task_success", intensity: EMOTIONAL_THRESHOLDS.TASK_SUCCESS_INTENSITY }
      ])
      await saveEmotionalState(updatedEmotion, "message_sent", `conv-${Date.now()}`)

      const episodeSummary = `Responded to ${messages.length} message(s) via conversation handler (${tier} tier)`

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
        responsesSent: validatedMessages.length,
        tier,
        model
      })

      if (!structuredResponse.expectsReply) {
        log.info("Response does not expect reply, ending conversation")
        continueConversation = false
      } else {
        const followUpWait = computeFollowUpWait(updatedEmotion)
        const { id: tokenId } = await wait.createToken({ timeout: `${followUpWait}s` })
        await setConversationWaitToken(tokenId)

        const followUpResult = await wait.forToken(tokenId)
        await clearConversationWaitToken()

        if (followUpResult.ok) {
          log.info("Follow-up token completed, checking for new messages")
        } else {
          log.info("Follow-up wait timed out, ending conversation", { waitSeconds: followUpWait })
          continueConversation = false
        }
      }
    }

    if (roundCount >= CONVERSATION.MAX_ROUNDS) {
      log.warn("Conversation hit max rounds limit", { rounds: roundCount })
    }

    log.info("Conversation handler finished", { rounds: roundCount })
    return { rounds: roundCount }
  }
})
