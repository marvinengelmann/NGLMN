import type { ConversationMessage, ConversationSlot } from "@/bridge/types.ts"
import { EMOTIONAL_THRESHOLDS } from "@/config/constants.ts"
import { callIntelligence, FAST, TextOutput } from "@/core/intelligence.ts"
import type { EmotionalState } from "@/emotion/types.ts"
import type { PendingMessage } from "@/integrations/types.ts"
import { log } from "@/lib/logger.ts"
import { queryRelated, storeEpisode, storeRelationshipEpisode } from "@/memory/episodic.ts"
import { CONVERSATION_BOUNDARY_PROMPT } from "@/prompts/conversation.ts"
import { ConversationBoundary } from "./types.ts"

/**
 * Detect whether new messages belong to the active conversation or start a new one.
 * Defaults to continuation on failure.
 */
export async function detectConversationBoundary(
  activeSlot: ConversationSlot,
  newMessages: PendingMessage[]
): Promise<ConversationBoundary> {
  if (activeSlot.messages.length === 0) {
    return { isNewConversation: false, reason: "active slot is empty, continue filling it" }
  }

  const historyText = activeSlot.messages
    .slice(-8)
    .map((m) => `[${m.role === "operator" ? "Operator" : "ANIMA"}]: ${m.text}`)
    .join("\n")
  const newText = newMessages.map((m) => `[Operator]: ${m.text}`).join("\n")

  const callResult = await callIntelligence({
    model: FAST,
    system: CONVERSATION_BOUNDARY_PROMPT,
    userMessage: `Previous conversation:\n${historyText}\n\nNew messages:\n${newText}`,
    schema: ConversationBoundary,
    maxTokens: 100
  })

  if (callResult.isErr()) {
    log.warn("Conversation boundary detection failed, assuming continuation", {
      error: callResult.error.message
    })
    return { isNewConversation: false, reason: "LLM call failed, assuming continuation" }
  }

  return callResult.value
}

/**
 * Archive a conversation slot by summarizing its messages and storing as an episode.
 * Does NOT modify the conversation buffer — the caller manages slot eviction.
 */
export async function archiveConversation(
  messages: ConversationMessage[],
  emotionalState: EmotionalState
): Promise<void> {
  if (messages.length === 0) return

  const conversationText = messages
    .map((m) => `[${m.role === "operator" ? "Operator" : "ANIMA"}]: ${m.text}`)
    .join("\n")

  const summaryResult = await callIntelligence({
    model: FAST,
    system:
      "Summarize this conversation in 1-2 sentences. Focus on the key topics discussed and any outcomes. Be concise.",
    userMessage: conversationText,
    schema: TextOutput,
    maxTokens: 150
  })

  if (summaryResult.isErr()) {
    log.warn("Failed to summarize conversation for archival", {
      error: summaryResult.error.message
    })
    return
  }

  if (emotionalState.connection > EMOTIONAL_THRESHOLDS.CONNECTION_HIGH) {
    await storeRelationshipEpisode(summaryResult.value.text)
  } else {
    await storeEpisode(summaryResult.value.text, "interaction", {
      relevanceScore: EMOTIONAL_THRESHOLDS.RELEVANCE_DEFAULT
    })
  }
}

/**
 * Search episodic memory for context related to a reply that references an archived message.
 * Returns formatted context string or null if nothing relevant found.
 */
export async function recallArchivedContext(
  replyToText: string,
  activeSlots: ConversationSlot[]
): Promise<string | null> {
  const foundInActive = activeSlots.some((slot) => slot.messages.some((m) => m.text === replyToText))
  if (foundInActive) return null

  const results = await queryRelated(replyToText, 3)
  const relevant = results.filter((r) => r.score > 0.7)
  if (relevant.length === 0) return null

  return relevant
    .map((r) => `[Recalled memory, relevance ${r.score.toFixed(2)}]: ${r.metadata?.category ?? "unknown"}`)
    .join("\n")
}
