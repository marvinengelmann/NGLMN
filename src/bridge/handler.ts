import type * as z from "zod"
import { CONVERSATION, FOLLOW_UP } from "@/config/constants.ts"
import { buildComplexContext, buildDeepContext, buildSimpleContext } from "@/core/context-builder.ts"
import type { TriageDecision } from "@/core/types.ts"
import type { EmotionalState } from "@/emotion/types.ts"
import type { PendingMessage } from "@/integrations/types.ts"
import { StructuredResponse } from "./types.ts"

type ResponseTier = Exclude<TriageDecision, "idle">

/**
 * Build the conversation response prompt for a given tier.
 */
export async function buildConversationResponsePrompt(
  messages: PendingMessage[],
  personalityPrompt: string,
  tier: ResponseTier
): Promise<string> {
  switch (tier) {
    case "simple":
      return buildSimpleContext(messages, personalityPrompt)
    case "complex":
      return buildComplexContext(messages, personalityPrompt)
    case "deep":
      return buildDeepContext(messages, personalityPrompt)
  }
}

/**
 * Parse a structured multi-message response from Claude.
 * Expects JSON format: {"messages": [{"text": "...", "replyTo": 123}], "expectsReply": true}
 * Falls back to wrapping raw text as a single message with expectsReply true.
 */
export function parseStructuredResponse(raw: string): z.infer<typeof StructuredResponse> {
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "")
    return StructuredResponse.parse(JSON.parse(cleaned))
  } catch {
    /* plain text fallback — expected when Claude doesn't return JSON */
  }

  return { messages: [{ text: raw.trim() }], expectsReply: true }
}

/**
 * Compute follow-up wait duration based on emotional state.
 * Higher connection/excitement = longer patience (up to 240s).
 * Higher boredom = shorter patience (down to 60s).
 */
export function computeFollowUpWait(emotion: EmotionalState): number {
  const baseWait = CONVERSATION.FOLLOW_UP_BASE_WAIT
  const connectionBoost = emotion.connection * FOLLOW_UP.CONNECTION_BOOST
  const excitementBoost = emotion.excitement * FOLLOW_UP.EXCITEMENT_BOOST
  const boredomPenalty = emotion.boredom * FOLLOW_UP.BOREDOM_PENALTY
  const waitSeconds = baseWait + connectionBoost + excitementBoost - boredomPenalty

  return Math.max(CONVERSATION.FOLLOW_UP_MIN_WAIT, Math.min(CONVERSATION.FOLLOW_UP_MAX_WAIT, Math.round(waitSeconds)))
}
