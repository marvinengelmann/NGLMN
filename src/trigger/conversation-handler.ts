import { task, wait } from "@trigger.dev/sdk"
import { formatISO } from "date-fns"
import { archiveConversation, detectConversationBoundary } from "@/bridge/conversation.ts"
import { buildConversationResponsePrompt, computeFollowUpWait, parseStructuredResponse } from "@/bridge/handler.ts"
import { computeReadTime, computeTypingDuration, simulateTyping } from "@/bridge/typing.ts"
import { CONVERSATION, EMOTIONAL_THRESHOLDS, MESSAGE_DELAY, TRIAGE_DEFAULTS } from "@/config/constants.ts"
import { buildTriageContext } from "@/core/context-builder.ts"
import { getMaxTokensForTier, getModelForPhase, selectModel } from "@/core/model-router.ts"
import { TriageResult } from "@/core/types.ts"
import { getEmotionalState, saveEmotionalState } from "@/emotion/state.ts"
import { computeEmotionalUpdate } from "@/emotion/update.ts"
import { loadPrompt } from "@/evolution/prompt-loader.ts"
import { callClaude, callClaudeWithUsage, stripCodeFences } from "@/integrations/anthropic.ts"
import { sendMessageWithReply, sendTypingAction } from "@/integrations/telegram.ts"
import { log } from "@/lib/logger.ts"
import { addBreadcrumb } from "@/lib/sentry.ts"
import { sleep } from "@/lib/time.ts"
import { storeEpisode, storeRelationshipEpisode } from "@/memory/episodic.ts"
import {
  clearConversationWaitToken,
  clearPendingMessages,
  getConversationHistory,
  peekAllPendingMessages,
  pushConversationMessage,
  pushRecentResponse,
  setConversationWaitToken,
  setGuardianResult
} from "@/memory/working.ts"
import { getEffectivePersonality } from "@/personality/dna.ts"
import { buildPersonalityPrompt } from "@/personality/expression.ts"
import { getMbtiType } from "@/personality/mbti.ts"
import { RESPONDER_SYSTEM_PROMPT } from "@/prompts/responder.ts"
import { TRIAGE_SYSTEM_PROMPT } from "@/prompts/triage.ts"
import { validateOutput } from "@/security/guardian.ts"
import type { ConversationHandlerPayload } from "@/trigger/types.ts"

/**
 * Dedicated conversation handler — manages all message-based interactions.
 * Supports multi-message structured responses, typing simulation,
 * reply-to specific messages, and follow-up waiting.
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

      const history = await getConversationHistory()

      if (history.length > 0 && messages.length > 0) {
        const boundary = await detectConversationBoundary(history, messages)
        if (boundary.isNewConversation) {
          log.info("New conversation detected, archiving old one", { reason: boundary.reason })
          const emotion = await getEmotionalState()
          await archiveConversation(history, emotion)
        }
      }

      const triageContext = await buildTriageContext()
      const messagesBlock = messages.map((m) => `[${m.from}]: ${m.text}`).join("\n")
      const conversationGuidance = [
        "You are triaging in CONVERSATION context — pending messages from the operator are provided below.",
        "Decide whether these messages warrant a response from ANIMA or not.",
        '"idle" = no response needed (e.g. acknowledgments like "ok", "👍", repeated goodbyes after ANIMA already said goodbye, pure reactions).',
        "Any other tier = ANIMA should respond at the appropriate depth."
      ].join("\n")
      const triageWithMessages = `${triageContext.userPrompt}\n\n${conversationGuidance}\n\nPending messages (${messages.length}):\n${messagesBlock}`

      const triagePrompt = await loadPrompt("triage", TRIAGE_SYSTEM_PROMPT)
      const triageCallResult = await callClaude({
        model: getModelForPhase("triage"),
        system: triagePrompt,
        userMessage: triageWithMessages,
        maxTokens: getMaxTokensForTier("triage")
      })

      if (triageCallResult.isErr()) {
        log.warn("Triage call failed in conversation", { error: triageCallResult.error.message })
        break
      }
      const triageRaw = triageCallResult.value

      let triageResult: TriageResult
      try {
        triageResult = TriageResult.parse(JSON.parse(stripCodeFences(triageRaw)))
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
          await pushConversationMessage({
            role: "operator",
            text: msg.text,
            timestamp: formatISO(new Date(msg.date * 1000))
          })
        }
        await clearPendingMessages()

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

      const contextPrompt = await buildConversationResponsePrompt(messages, personalityPrompt, tier)

      const responderPrompt = await loadPrompt("responder", RESPONDER_SYSTEM_PROMPT)
      const responderCallResult = await callClaudeWithUsage({
        model,
        system: responderPrompt,
        userMessage: contextPrompt,
        maxTokens: getMaxTokensForTier(tier)
      })

      if (responderCallResult.isErr()) {
        log.warn("Responder call failed", { error: responderCallResult.error.message })
        await clearPendingMessages()
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
        await clearPendingMessages()
        break
      }

      const readTime = computeReadTime(messages)
      await sleep(readTime)

      for (const msg of messages) {
        await pushConversationMessage({
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

        await pushConversationMessage({
          role: "anima",
          text: msg.text,
          timestamp: formatISO(new Date())
        })

        await pushRecentResponse(msg.text)

        if (i < validatedMessages.length - 1) {
          await sleep(MESSAGE_DELAY.MIN_BETWEEN_MESSAGES_MS + Math.random() * MESSAGE_DELAY.MAX_JITTER_MS)
        }
      }

      await clearPendingMessages()

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
