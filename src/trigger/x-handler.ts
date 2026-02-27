import { task } from "@trigger.dev/sdk"
import { formatISO } from "date-fns"
import { EMOTIONAL_THRESHOLDS } from "@/config/constants.ts"
import { callIntelligence, getMaxTokensForTier, selectModel, TextOutput } from "@/core/intelligence.ts"
import type { TriageResult } from "@/core/types.ts"
import { getEmotionalState, processEmotionTrigger, saveEmotionalState } from "@/emotion/state.ts"
import { computeEmotionalUpdate } from "@/emotion/update.ts"
import { loadPrompt } from "@/evolution/prompt-loader.ts"
import { escapeTelegramMarkdown, sendToOperator } from "@/integrations/telegram.ts"
import type { PendingMention } from "@/integrations/types.ts"
import { replyToTweet } from "@/integrations/x.ts"
import { log } from "@/lib/logger.ts"
import { captureError } from "@/lib/sentry.ts"
import { storeEpisode } from "@/memory/episodic.ts"
import { clearProcessedMentions, peekAllPendingMentions, pushPendingMentions } from "@/memory/working.ts"
import { getEffectivePersonality } from "@/personality/dna.ts"
import { buildPersonalityPrompt } from "@/personality/expression.ts"
import { getMbtiType } from "@/personality/mbti.ts"
import { RESPONDER_SYSTEM_PROMPT } from "@/prompts/responder.ts"
import { validatePublicOutput } from "@/security/guardian.ts"
import { wrapExternalData } from "@/security/injection-defense.ts"
import { canActAutonomously } from "@/trust/assessment.ts"
import { recordFailure, recordSuccess } from "@/trust/history.ts"

const X_DEFAULTS = {
  TRIAGE_DECISION: "complex" as const,
  TRIAGE_CONFIDENCE: 0.8,
  TRIAGE_ESTIMATED_TOKENS: 400,
  RELEVANCE_SCORE: 0.8,
  TRUST_BLOCKED_RELEVANCE: 0.8
}

/**
 * Dedicated X handler — processes pending mentions independently from the heartbeat.
 */
export const xHandlerTask = task({
  id: "x-handler",
  queue: {
    concurrencyLimit: 1
  },
  run: async () => {
    const mentions = await peekAllPendingMentions()
    if (mentions.length === 0) {
      return { processed: 0 }
    }

    const trust = await canActAutonomously("x_post")
    if (!trust.canAct) {
      log.warn("Trust gate blocked X response", { reason: trust.reason })
      await storeEpisode(`Trust gate blocked X action: ${trust.reason}`, "observation", {
        relevanceScore: X_DEFAULTS.TRUST_BLOCKED_RELEVANCE
      })
      return { processed: 0, reason: "trust_blocked" }
    }

    const [personality, emotion] = await Promise.all([getEffectivePersonality(), getEmotionalState()])
    const personalityPrompt = buildPersonalityPrompt(personality, emotion, getMbtiType())
    const responderPrompt = await loadPrompt("responder", RESPONDER_SYSTEM_PROMPT)

    const triageForModel: TriageResult = {
      decision: X_DEFAULTS.TRIAGE_DECISION,
      reason: "x mention response",
      confidence: X_DEFAULTS.TRIAGE_CONFIDENCE,
      estimatedTokens: X_DEFAULTS.TRIAGE_ESTIMATED_TOKENS
    }

    let processed = 0
    const failedMentions: PendingMention[] = []

    try {
      for (const mention of mentions) {
        const mentionContext = [
          `Current time: ${formatISO(new Date())}`,
          `Response language: English`,
          personalityPrompt,
          "",
          "PUBLIC X (Twitter) mention to respond to.",
          'IMPORTANT: Your response will be PUBLIC. Max 280 characters. Always respond in English. Always use first person ("I", "my") — never refer to yourself in the third person. Be concise, authentic, and appropriate for a public audience.',
          "",
          `From: @${wrapExternalData(mention.authorUsername, "x_username", "external")}`,
          `Tweet: ${wrapExternalData(mention.text, "x_mention", "external")}`
        ].join("\n")

        const model = selectModel(triageForModel)
        const replyResult = await callIntelligence({
          model,
          system: responderPrompt,
          userMessage: mentionContext,
          schema: TextOutput,
          maxTokens: getMaxTokensForTier("complex")
        })

        if (replyResult.isErr()) {
          log.warn("X reply call failed", { author: mention.authorUsername, error: replyResult.error.message })
          await processEmotionTrigger(
            { trigger: "task_failure", intensity: EMOTIONAL_THRESHOLDS.TASK_FAILURE_INTENSITY },
            "task_failure",
            `x-fail-${Date.now()}`
          )
          failedMentions.push(mention)
          continue
        }
        const replyText = replyResult.value.text

        const guardianResult = await validatePublicOutput(replyText)
        if (guardianResult.verdict === "blocked") {
          log.warn("Guardian blocked X response", { reasons: guardianResult.reasons })
          await processEmotionTrigger(
            { trigger: "guardian_block", intensity: EMOTIONAL_THRESHOLDS.GUARDIAN_BLOCK_INTENSITY },
            "guardian_block",
            `x-guardian-${Date.now()}`
          )
          failedMentions.push(mention)
          continue
        }

        const tweetId = await replyToTweet(replyText, mention.tweetId)
        if (!tweetId) {
          failedMentions.push(mention)
          continue
        }

        const safeAuthor = escapeTelegramMarkdown(mention.authorUsername)
        const safePreview = escapeTelegramMarkdown(replyText.slice(0, 200))
        await sendToOperator(`\uD83D\uDC26 X reply sent\nTo: @${safeAuthor}\n\n${safePreview}`)

        await storeEpisode(
          `Replied to X mention from @${mention.authorUsername}: "${mention.text.slice(0, 100)}"`,
          "interaction",
          { relevanceScore: X_DEFAULTS.RELEVANCE_SCORE }
        )

        await recordSuccess("x_post")
        processed++
      }

      if (processed > 0) {
        const updatedEmotion = computeEmotionalUpdate(emotion, [
          { trigger: "tweet_sent", intensity: EMOTIONAL_THRESHOLDS.TWEET_SENT_INTENSITY }
        ])
        await saveEmotionalState(updatedEmotion, "tweet_sent", `x-${Date.now()}`)
      }
    } catch (e) {
      captureError(e, { phase: "x_handler" })
      log.warn("X handler failed", { error: String(e) })
      await recordFailure("x_post")
    }

    await clearProcessedMentions(mentions.length)
    if (failedMentions.length > 0) {
      await pushPendingMentions(failedMentions)
      log.warn("Re-queued failed X mentions for retry", { count: failedMentions.length })
    }

    log.info("X handler complete", { processed, total: mentions.length })
    return { processed }
  }
})
