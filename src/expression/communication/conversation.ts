import { differenceInMinutes, parseISO } from "date-fns"
import { EMOTIONAL_THRESHOLDS } from "@/affect/emotion/constants.ts"
import type { EmotionalState } from "@/affect/emotion/types.ts"
import { callIntelligence } from "@/core/intelligence.ts"
import { TextOutput } from "@/core/types.ts"
import {
  ConversationClimate,
  type ConversationMessage,
  type ConversationSlot
} from "@/expression/communication/types.ts"
import { db } from "@/infra/db/client.ts"
import { conversationArcs } from "@/infra/db/schema.ts"
import { log } from "@/infra/lib/logger.ts"
import { queryRelated, storeEpisode, storeRelationshipEpisode } from "@/memory/episodic.ts"
import { storeKnowledge } from "@/memory/semantic.ts"
import { CONVERSATION } from "./constants.ts"

/**
 * Detect whether new messages start a new conversation based on time gap.
 */
export function detectConversationBoundary(activeSlot: ConversationSlot, newMessageTimestamp: string): boolean {
  if (activeSlot.messages.length === 0) return false

  const gap = differenceInMinutes(parseISO(newMessageTimestamp), parseISO(activeSlot.lastActivityAt))
  return gap >= CONVERSATION.GAP_MINUTES
}

/**
 * Archive a conversation slot by summarizing its messages, storing as an episode, and persisting the arc.
 */
export async function archiveConversation(
  slot: ConversationSlot,
  emotionalState: EmotionalState
): Promise<ConversationClimate | null> {
  if (slot.messages.length === 0) return null

  const conversationText = slot.messages
    .map((m) => `[${m.role === "operator" ? "Operator" : "ANIMA"}]: ${m.text}`)
    .join("\n")

  const summaryResult = await callIntelligence({
    system:
      "Summarize this conversation in 2-3 sentences. Focus on the key topics discussed, emotional dynamics, and any outcomes. Be concise but capture the emotional texture.",
    userMessage: conversationText,
    schema: TextOutput,
    maxTokens: CONVERSATION.ARCHIVE_SUMMARY_MAX_TOKENS,
    reasoning: false
  })

  if (summaryResult.isErr()) {
    log.warn("Failed to summarize conversation for archival", {
      error: summaryResult.error.message
    })
    return null
  }

  if (emotionalState.connection > EMOTIONAL_THRESHOLDS.CONNECTION_HIGH) {
    await storeRelationshipEpisode(summaryResult.value.text)
  } else {
    await storeEpisode(summaryResult.value.text, "interaction", {
      relevanceScore: EMOTIONAL_THRESHOLDS.RELEVANCE_DEFAULT
    })
  }

  const climate = await computeConversationClimate(slot.messages)
  if (climate) {
    await storeKnowledge("insight", `conversation-climate-${slot.id}`, climate, "observation", 0.7, "self")

    await db.insert(conversationArcs).values({
      conversationId: slot.id,
      startedAt: new Date(slot.startedAt),
      endedAt: new Date(slot.lastActivityAt),
      themes: climate.themes,
      tone: climate.tone,
      emotionalArc: climate.emotionalArc,
      operatorEngagement: climate.operatorEngagement,
      unresolvedTopics: climate.unresolvedTopics,
      significantMoments: climate.significantMoments,
      messageCount: slot.messages.length
    })
  }

  return climate
}

const CLIMATE_PROMPT = `Analyze this conversation and determine its emotional climate.
Return a JSON object with:
- tone: one of "warm", "tense", "playful", "serious", "intimate", "distant"
- emotionalArc: { start: -1 to 1, peak: -1 to 1, end: -1 to 1 } (negative=negative emotion, positive=positive)
- themes: array of up to 5 key themes discussed
- unresolvedTopics: array of topics that were raised but not fully addressed
- operatorEngagement: 0 to 1, how engaged the operator seemed
- significantMoments: array of brief descriptions of emotionally significant moments`

/**
 * Compute the emotional climate of a conversation via LLM analysis.
 */
export async function computeConversationClimate(messages: ConversationMessage[]): Promise<ConversationClimate | null> {
  if (messages.length < 2) return null

  const conversationText = messages
    .map((m) => `[${m.role === "operator" ? "Operator" : "ANIMA"}]: ${m.text}`)
    .join("\n")

  const result = await callIntelligence({
    system: CLIMATE_PROMPT,
    userMessage: conversationText,
    schema: ConversationClimate,
    maxTokens: 512,
    reasoning: false
  })

  if (result.isErr()) {
    log.warn("Failed to compute conversation climate", { error: result.error.message })
    return null
  }

  return result.value
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
