import { EMOTIONAL_THRESHOLDS } from "@/config/constants.ts"
import { escapeTelegramMarkdown } from "@/integrations/telegram.ts"
import type { PendingMention } from "@/integrations/types.ts"
import { replyToTweet } from "@/integrations/x.ts"
import { nowISO } from "@/lib/time.ts"
import { clearProcessedMentions, peekAllPendingMentions, pushPendingMentions } from "@/memory/working.ts"
import { wrapExternalData } from "@/security/defense.ts"
import { validatePublicOutput } from "@/security/guardian.ts"
import type { ChannelConfig } from "./processor.ts"

const X_DEFAULTS = {
  TRIAGE_DECISION: "complex" as const,
  TRIAGE_CONFIDENCE: 0.8,
  TRIAGE_ESTIMATED_TOKENS: 400,
  RELEVANCE_SCORE: 0.8,
  TRUST_BLOCKED_RELEVANCE: 0.8
}

export const xChannelConfig: ChannelConfig<PendingMention> = {
  channelName: "x",
  trustAction: "x_post",
  defaults: {
    triageDecision: X_DEFAULTS.TRIAGE_DECISION,
    triageConfidence: X_DEFAULTS.TRIAGE_CONFIDENCE,
    triageEstimatedTokens: X_DEFAULTS.TRIAGE_ESTIMATED_TOKENS,
    relevanceScore: X_DEFAULTS.RELEVANCE_SCORE,
    trustBlockedRelevance: X_DEFAULTS.TRUST_BLOCKED_RELEVANCE
  },
  fetchItems: peekAllPendingMentions,
  clearItems: clearProcessedMentions,
  requeueItems: pushPendingMentions,

  buildContext: (mention, consciousnessPrompt) =>
    [
      `Current time: ${nowISO()}`,
      "Response language: English",
      consciousnessPrompt,
      "",
      "PUBLIC X (Twitter) mention to respond to.",
      'IMPORTANT: Your response will be PUBLIC. Max 280 characters. Always respond in English. Always use first person ("I", "my") — never refer to yourself in the third person. Be concise, authentic, and appropriate for a public audience.',
      "",
      `From: @${wrapExternalData(mention.authorUsername, "x_username", "external")}`,
      `Tweet: ${wrapExternalData(mention.text, "x_mention", "external")}`
    ].join("\n"),

  validateResponse: validatePublicOutput,

  sendResponse: async (mention, replyText) => {
    const tweetId = await replyToTweet(replyText, mention.tweetId)
    return !!tweetId
  },

  buildNotification: (mention, replyText) => {
    const safeAuthor = escapeTelegramMarkdown(mention.authorUsername)
    const safePreview = escapeTelegramMarkdown(replyText.slice(0, 200))
    return `🐦 X reply sent\nTo: @${safeAuthor}\n\n${safePreview}`
  },

  buildEpisodeText: (mention) =>
    `Replied to X mention from @${mention.authorUsername}: "${mention.text.slice(0, 100)}"`,
  emotionTrigger: "tweet_sent",
  emotionIntensity: EMOTIONAL_THRESHOLDS.TWEET_SENT_INTENSITY
}
