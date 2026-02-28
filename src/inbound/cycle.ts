import { hasEmailConfig, hasXConfig } from "@/config/env.ts"
import { emailChannelConfig } from "@/inbound/email.ts"
import { processInboundItems } from "@/inbound/processor.ts"
import { xChannelConfig } from "@/inbound/x.ts"
import { pollNewEmails } from "@/integrations/resend.ts"
import { pollNewMentions } from "@/integrations/x.ts"
import { log } from "@/lib/logger.ts"

export interface InboundCycleResult {
  polled: { emails: number; mentions: number }
  processed: { emails: number; mentions: number }
}

/**
 * Unified inbound cycle — polls and processes emails + X mentions.
 */
export async function runInboundCycle(): Promise<InboundCycleResult> {
  const [emailPollResult, xPollResult] = await Promise.allSettled([
    hasEmailConfig() ? pollNewEmails() : Promise.resolve(0),
    hasXConfig() ? pollNewMentions() : Promise.resolve(0)
  ])

  const emailCount = emailPollResult.status === "fulfilled" ? emailPollResult.value : 0
  const mentionCount = xPollResult.status === "fulfilled" ? xPollResult.value : 0

  if (emailPollResult.status === "rejected") {
    log.warn("Email poll failed", { error: String(emailPollResult.reason) })
  }
  if (xPollResult.status === "rejected") {
    log.warn("X poll failed", { error: String(xPollResult.reason) })
  }

  log.info("Inbound poll complete", { newEmails: emailCount, newMentions: mentionCount })

  const [emailResult, xResult] = await Promise.allSettled([
    emailCount > 0 ? processInboundItems(emailChannelConfig) : Promise.resolve({ processed: 0 }),
    mentionCount > 0 ? processInboundItems(xChannelConfig) : Promise.resolve({ processed: 0 })
  ])

  const emailProcessed = emailResult.status === "fulfilled" ? emailResult.value.processed : 0
  const xProcessed = xResult.status === "fulfilled" ? xResult.value.processed : 0

  if (emailResult.status === "rejected") {
    log.warn("Email handler failed", { error: String(emailResult.reason) })
  }
  if (xResult.status === "rejected") {
    log.warn("X handler failed", { error: String(xResult.reason) })
  }

  return {
    polled: { emails: emailCount, mentions: mentionCount },
    processed: { emails: emailProcessed, mentions: xProcessed }
  }
}
