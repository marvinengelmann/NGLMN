import { differenceInMinutes, parseISO } from "date-fns"
import type { ConversationMessage, ConversationSlot } from "@/communication/types.ts"
import { CONVERSATION, EMOTIONAL_THRESHOLDS } from "@/config/constants.ts"
import { callIntelligence } from "@/core/intelligence.ts"
import { TextOutput } from "@/core/types.ts"
import type { EmotionalState } from "@/emotion/types.ts"
import { log } from "@/lib/logger.ts"
import { queryRelated, storeEpisode, storeRelationshipEpisode } from "@/memory/episodic.ts"

/**
 * Detect whether new messages start a new conversation based on time gap.
 */
export function detectConversationBoundary(activeSlot: ConversationSlot, newMessageTimestamp: string): boolean {
  if (activeSlot.messages.length === 0) return false

  const gap = differenceInMinutes(parseISO(newMessageTimestamp), parseISO(activeSlot.lastActivityAt))
  return gap >= CONVERSATION.GAP_MINUTES
}

/**
 * Archive a conversation slot by summarizing its messages and storing as an episode.
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
    system:
      "Summarize this conversation in 1-2 sentences. Focus on the key topics discussed and any outcomes. Be concise.",
    userMessage: conversationText,
    schema: TextOutput,
    maxTokens: 150,
    reasoning: false
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
    .map((r) => `[Recalled memory, relevance ${r.score.toFixed(2)}]: ${r.data ?? r.metadata?.category ?? "unknown"}`)
    .join("\n")
}
