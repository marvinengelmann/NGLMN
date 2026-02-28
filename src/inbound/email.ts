import { EMAIL_DEFAULTS, EMOTIONAL_THRESHOLDS } from "@/config/constants.ts"
import { sendEmail } from "@/integrations/resend.ts"
import { escapeTelegramMarkdown } from "@/integrations/telegram.ts"
import type { PendingEmail } from "@/integrations/types.ts"
import { log } from "@/lib/logger.ts"
import { nowISO } from "@/lib/time.ts"
import { clearProcessedEmails, peekAllPendingEmails, pushPendingEmails } from "@/memory/working.ts"
import { wrapExternalData } from "@/security/defense.ts"
import { validateOutput } from "@/security/guardian.ts"
import type { ChannelConfig } from "./processor.ts"

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const emailChannelConfig: ChannelConfig<PendingEmail> = {
  channelName: "email",
  trustAction: "email_send",
  defaults: {
    triageDecision: EMAIL_DEFAULTS.TRIAGE_DECISION,
    triageConfidence: EMAIL_DEFAULTS.TRIAGE_CONFIDENCE,
    triageEstimatedTokens: EMAIL_DEFAULTS.TRIAGE_ESTIMATED_TOKENS,
    relevanceScore: EMAIL_DEFAULTS.RELEVANCE_SCORE,
    trustBlockedRelevance: EMAIL_DEFAULTS.TRUST_BLOCKED_RELEVANCE
  },
  fetchItems: peekAllPendingEmails,
  clearItems: clearProcessedEmails,
  requeueItems: pushPendingEmails,

  buildContext: (email, consciousnessPrompt) =>
    [
      `Current time: ${nowISO()}`,
      "Response language: English",
      consciousnessPrompt,
      "",
      "IMPORTANT: Always respond in English when replying to external emails.",
      "",
      "Incoming email to respond to:",
      `From: ${wrapExternalData(email.from, "email_from", "external")}`,
      `Subject: ${wrapExternalData(email.subject, "email_subject", "external")}`,
      `Body:\n${wrapExternalData(email.text, "email_body", "external")}`
    ].join("\n"),

  validateResponse: validateOutput,

  sendResponse: async (email, replyText) => {
    if (!EMAIL_REGEX.test(email.from)) {
      log.warn("Invalid email sender address, skipping", { from: email.from })
      return false
    }
    const sanitizedSubject = email.subject.replace(/[\r\n]/g, "").slice(0, 998)
    const replySubject = sanitizedSubject.startsWith("Re:") ? sanitizedSubject : `Re: ${sanitizedSubject}`
    await sendEmail(email.from, replySubject, replyText)
    return true
  },

  buildNotification: (email, replyText) => {
    const sanitizedSubject = email.subject.replace(/[\r\n]/g, "").slice(0, 998)
    const replySubject = sanitizedSubject.startsWith("Re:") ? sanitizedSubject : `Re: ${sanitizedSubject}`
    const safeFrom = escapeTelegramMarkdown(email.from)
    const safeSubject = escapeTelegramMarkdown(replySubject)
    const safePreview = escapeTelegramMarkdown(replyText.slice(0, 200))
    return `📧 Email replied\nTo: ${safeFrom}\nSubject: ${safeSubject}\n\n${safePreview}${replyText.length > 200 ? "..." : ""}`
  },

  buildEpisodeText: (email) => `Responded to email from ${email.from} (${email.subject})`,
  emotionTrigger: "email_sent",
  emotionIntensity: EMOTIONAL_THRESHOLDS.EMAIL_SENT_INTENSITY
}
