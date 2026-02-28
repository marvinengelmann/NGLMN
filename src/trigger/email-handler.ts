import { task } from "@trigger.dev/sdk"
import { formatISO } from "date-fns"
import { EMAIL_DEFAULTS, EMOTIONAL_THRESHOLDS } from "@/config/constants.ts"
import { buildConsciousnessPrompt } from "@/core/consciousness.ts"
import { callIntelligence, getMaxTokensForTier, selectModel, TextOutput } from "@/core/intelligence.ts"
import type { TriageResult } from "@/core/types.ts"
import { getEmotionalState, processEmotionTrigger, saveEmotionalState } from "@/emotion/state.ts"
import { computeEmotionalUpdate } from "@/emotion/update.ts"
import { loadPrompt } from "@/evolution/prompt-loader.ts"
import { sendEmail } from "@/integrations/resend.ts"
import { escapeTelegramMarkdown, sendGuardianAlert, sendToOperator } from "@/integrations/telegram.ts"
import { log } from "@/lib/logger.ts"
import { captureError } from "@/lib/sentry.ts"
import { storeEpisode } from "@/memory/episodic.ts"
import { clearProcessedEmails, peekAllPendingEmails, pushPendingEmails } from "@/memory/working.ts"
import { RESPONDER_SYSTEM_PROMPT } from "@/prompts/responder.ts"
import { validateOutput } from "@/security/guardian.ts"
import { wrapExternalData } from "@/security/injection-defense.ts"
import { canActAutonomously } from "@/trust/assessment.ts"
import { recordFailure, recordSuccess } from "@/trust/history.ts"

/**
 * Dedicated email handler — processes pending emails independently from the heartbeat.
 */
export const emailHandlerTask = task({
  id: "email-handler",
  queue: {
    concurrencyLimit: 1
  },
  run: async () => {
    const emails = await peekAllPendingEmails()
    if (emails.length === 0) {
      return { processed: 0 }
    }

    const trust = await canActAutonomously("email_send")
    if (!trust.canAct) {
      log.warn("Trust gate blocked email response", { reason: trust.reason })
      await storeEpisode(`Trust gate blocked email action: ${trust.reason}`, "observation", {
        relevanceScore: EMAIL_DEFAULTS.TRUST_BLOCKED_RELEVANCE
      })
      return { processed: 0, reason: "trust_blocked" }
    }

    const emotion = await getEmotionalState()
    const consciousnessPrompt = await buildConsciousnessPrompt(emotion)
    const responderPrompt = await loadPrompt("responder", RESPONDER_SYSTEM_PROMPT)

    const triageForModel: TriageResult = {
      decision: EMAIL_DEFAULTS.TRIAGE_DECISION,
      reason: "email response",
      confidence: EMAIL_DEFAULTS.TRIAGE_CONFIDENCE,
      estimatedTokens: EMAIL_DEFAULTS.TRIAGE_ESTIMATED_TOKENS
    }

    let processed = 0
    const failedEmails: typeof emails = []

    try {
      for (const email of emails) {
        const emailContext = [
          `Current time: ${formatISO(new Date())}`,
          `Response language: English`,
          consciousnessPrompt,
          "",
          "IMPORTANT: Always respond in English when replying to external emails.",
          "",
          "Incoming email to respond to:",
          `From: ${wrapExternalData(email.from, "email_from", "external")}`,
          `Subject: ${wrapExternalData(email.subject, "email_subject", "external")}`,
          `Body:\n${wrapExternalData(email.text, "email_body", "external")}`
        ].join("\n")

        const model = selectModel(triageForModel)
        const emailReplyResult = await callIntelligence({
          model,
          system: responderPrompt,
          userMessage: emailContext,
          schema: TextOutput,
          maxTokens: getMaxTokensForTier("complex")
        })

        if (emailReplyResult.isErr()) {
          log.warn("Email reply call failed", { email: email.from, error: emailReplyResult.error.message })
          await processEmotionTrigger(
            { trigger: "task_failure", intensity: EMOTIONAL_THRESHOLDS.TASK_FAILURE_INTENSITY },
            "task_failure",
            `email-fail-${Date.now()}`
          )
          failedEmails.push(email)
          continue
        }
        const emailReply = emailReplyResult.value.text

        const guardianResult = await validateOutput(emailReply)
        if (guardianResult.verdict === "blocked") {
          log.warn("Guardian blocked email response", { reasons: guardianResult.reasons })
          await sendGuardianAlert(guardianResult)
          await processEmotionTrigger(
            { trigger: "guardian_block", intensity: EMOTIONAL_THRESHOLDS.GUARDIAN_BLOCK_INTENSITY },
            "guardian_block",
            `email-guardian-${Date.now()}`
          )
          failedEmails.push(email)
          continue
        }

        if (guardianResult.verdict === "warning") {
          await sendGuardianAlert(guardianResult)
          await processEmotionTrigger(
            { trigger: "guardian_warning", intensity: EMOTIONAL_THRESHOLDS.GUARDIAN_WARNING_INTENSITY },
            "guardian_warning",
            `email-guardian-${Date.now()}`
          )
        }

        const sanitizedSubject = email.subject.replace(/[\r\n]/g, "").slice(0, 998)
        const replySubject = sanitizedSubject.startsWith("Re:") ? sanitizedSubject : `Re: ${sanitizedSubject}`

        const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!EMAIL_REGEX.test(email.from)) {
          log.warn("Invalid email sender address, skipping", { from: email.from })
          continue
        }

        await sendEmail(email.from, replySubject, emailReply)

        const safeFrom = escapeTelegramMarkdown(email.from)
        const safeSubject = escapeTelegramMarkdown(replySubject)
        const safePreview = escapeTelegramMarkdown(emailReply.slice(0, 200))
        await sendToOperator(
          `\uD83D\uDCE7 Email replied\nTo: ${safeFrom}\nSubject: ${safeSubject}\n\n${safePreview}${emailReply.length > 200 ? "..." : ""}`
        )

        await storeEpisode(`Responded to email from ${email.from} (${email.subject})`, "interaction", {
          relevanceScore: EMAIL_DEFAULTS.RELEVANCE_SCORE
        })

        await recordSuccess("email_send")
        processed++
      }

      if (processed > 0) {
        const updatedEmotion = computeEmotionalUpdate(emotion, [
          { trigger: "email_sent", intensity: EMOTIONAL_THRESHOLDS.EMAIL_SENT_INTENSITY }
        ])
        await saveEmotionalState(updatedEmotion, "email_sent", `email-${Date.now()}`)
      }
    } catch (e) {
      captureError(e, { phase: "email_handler" })
      log.warn("Email handler failed", { error: String(e) })
      await recordFailure("email_send")
    }

    await clearProcessedEmails(emails.length)
    if (failedEmails.length > 0) {
      await pushPendingEmails(failedEmails)
      log.warn("Re-queued failed emails for retry", { count: failedEmails.length })
    }

    log.info("Email handler complete", { processed, total: emails.length })
    return { processed }
  }
})
