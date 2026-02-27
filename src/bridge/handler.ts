import { CONVERSATION, FOLLOW_UP } from "@/config/constants.ts"
import { buildComplexContext, buildDeepContext, buildSimpleContext } from "@/core/context-builder.ts"
import type { TriageDecision } from "@/core/types.ts"
import type { EmotionalState } from "@/emotion/types.ts"
import type { PendingMessage } from "@/integrations/types.ts"

type ResponseTier = Exclude<TriageDecision, "idle">

/**
 * Build the conversation response prompt for a given tier.
 */
export async function buildConversationResponsePrompt(
  messages: PendingMessage[],
  personalityPrompt: string,
  tier: ResponseTier,
  recalledContext?: string | null
): Promise<string> {
  let baseContext: string
  switch (tier) {
    case "simple":
      baseContext = await buildSimpleContext(messages, personalityPrompt)
      break
    case "complex":
      baseContext = await buildComplexContext(messages, personalityPrompt)
      break
    case "deep":
      baseContext = await buildDeepContext(messages, personalityPrompt)
      break
  }
  if (recalledContext) {
    return `${baseContext}\n\nRecalled context from earlier conversations:\n${recalledContext}`
  }
  return baseContext
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
