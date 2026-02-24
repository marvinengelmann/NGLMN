import type { ConversationMessage } from "@/bridge/types.ts"
import { EMOTIONAL_THRESHOLDS } from "@/config/constants.ts"
import type { EmotionalState } from "@/emotion/types.ts"
import { callClaude, HAIKU, stripCodeFences } from "@/integrations/anthropic.ts"
import type { PendingMessage } from "@/integrations/types.ts"
import { log } from "@/lib/logger.ts"
import { storeEpisode, storeRelationshipEpisode } from "@/memory/episodic.ts"
import { clearConversationHistory } from "@/memory/working.ts"
import { CONVERSATION_BOUNDARY_PROMPT } from "@/prompts/conversation.ts"
import { ConversationBoundary } from "./types.ts"

/**
 * Detect whether new messages belong to an existing conversation or start a new one.
 * Uses Haiku for lightweight classification.
 */
export async function detectConversationBoundary(
  history: ConversationMessage[],
  newMessages: PendingMessage[]
): Promise<ConversationBoundary> {
  if (history.length === 0) {
    return {
      isNewConversation: true,
      reason: "no prior history"
    }
  }

  const historyText = history
    .slice(-6)
    .map((m) => `[${m.role === "operator" ? "Operator" : "ANIMA"}]: ${m.text}`)
    .join("\n")
  const newText = newMessages.map((m) => `[${m.from}]: ${m.text}`).join("\n")
  const callResult = await callClaude({
    model: HAIKU,
    system: CONVERSATION_BOUNDARY_PROMPT,
    userMessage: `Previous conversation:\n${historyText}\n\nNew messages:\n${newText}`,
    maxTokens: 100
  })

  if (callResult.isErr()) {
    log.warn("Conversation boundary detection failed, assuming continuation", {
      error: callResult.error.message
    })
    return {
      isNewConversation: false,
      reason: "LLM call failed, assuming continuation"
    }
  }

  try {
    return ConversationBoundary.parse(JSON.parse(stripCodeFences(callResult.value)))
  } catch (e) {
    log.warn("Conversation boundary parse failed, assuming continuation", { error: String(e) })
    return {
      isNewConversation: false,
      reason: "parse failed, assuming continuation"
    }
  }
}

/**
 * Archive a conversation by summarizing it, storing as episode, and clearing history.
 */
export async function archiveConversation(
  history: ConversationMessage[],
  emotionalState: EmotionalState
): Promise<void> {
  if (history.length === 0) return

  const conversationText = history.map((m) => `[${m.role === "operator" ? "Operator" : "ANIMA"}]: ${m.text}`).join("\n")
  const summaryResult = await callClaude({
    model: HAIKU,
    system:
      "Summarize this conversation in 1-2 sentences. Focus on the key topics discussed and any outcomes. Be concise.",
    userMessage: conversationText,
    maxTokens: 150
  })

  if (summaryResult.isErr()) {
    log.warn("Failed to summarize conversation for archival", {
      error: summaryResult.error.message
    })
    await clearConversationHistory()

    return
  }

  if (emotionalState.connection > EMOTIONAL_THRESHOLDS.CONNECTION_HIGH) {
    await storeRelationshipEpisode(summaryResult.value)
  } else {
    await storeEpisode(summaryResult.value, "interaction", {
      relevanceScore: EMOTIONAL_THRESHOLDS.RELEVANCE_DEFAULT
    })
  }

  await clearConversationHistory()
}
