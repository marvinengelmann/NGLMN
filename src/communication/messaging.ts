import { computeTypingDuration, simulateTyping, splitIntoParagraphs } from "@/communication/timing.ts"
import { MESSAGE_DELAY, THINKING } from "@/config/constants.ts"
import type { AnimaDecision } from "@/consciousness/types.ts"
import { sendMessageWithReply, sendTypingAction } from "@/integrations/telegram.ts"
import { log } from "@/lib/logger.ts"
import { nowISO } from "@/lib/time.ts"
import { pushRecentResponse, pushToActiveConversation, setGuardianResult } from "@/memory/working.ts"
import { handleGuardianVerdict, validateOutput } from "@/security/guardian.ts"

interface MessagingResult {
  responseSent: boolean
  responseText?: string
}

/**
 * Send ANIMA's messages to the operator via Telegram with guardian validation,
 * paragraph splitting, and typing simulation.
 */
export async function sendMessages(decision: AnimaDecision): Promise<MessagingResult> {
  const allTexts: string[] = []

  for (const msg of decision.messages) {
    const guardianResult = await validateOutput(msg.text)
    await setGuardianResult(guardianResult)

    const { blocked } = await handleGuardianVerdict(guardianResult, "anima-message")
    if (blocked) {
      log.warn("Guardian blocked message", { text: msg.text.slice(0, 50) })
      continue
    }

    const paragraphs = splitIntoParagraphs(msg.text)
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i]
      if (!paragraph) continue

      if (i > 0) {
        const pause =
          THINKING.INTER_PARAGRAPH_MIN_MS +
          Math.random() * (THINKING.INTER_PARAGRAPH_MAX_MS - THINKING.INTER_PARAGRAPH_MIN_MS)
        await new Promise((resolve) => setTimeout(resolve, pause))
      }

      await simulateTyping(computeTypingDuration(paragraph), sendTypingAction)
      const sentId = await sendMessageWithReply(paragraph, i === 0 ? msg.replyTo : undefined)

      await pushToActiveConversation([{ role: "anima", text: paragraph, timestamp: nowISO(), messageId: sentId }])
    }

    allTexts.push(msg.text)
    await pushRecentResponse(msg.text)

    if (msg !== decision.messages[decision.messages.length - 1]) {
      const delay = MESSAGE_DELAY.MIN_BETWEEN_MESSAGES_MS + Math.random() * MESSAGE_DELAY.MAX_JITTER_MS
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  return {
    responseSent: allTexts.length > 0,
    responseText: allTexts.join("\n")
  }
}
