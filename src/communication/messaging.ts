import { computeTypingDuration, simulateTyping, splitIntoParagraphs } from "@/communication/timing.ts"
import { maybeIntroduceTypo } from "@/communication/typos.ts"
import { MESSAGE_DELAY, THINKING, TYPOS } from "@/config/constants.ts"
import type { AnimaDecision } from "@/consciousness/types.ts"
import { textToSpeech } from "@/integrations/elevenlabs.ts"
import { redis } from "@/integrations/redis.ts"
import {
  sendMessageWithReply,
  sendRecordVoiceAction,
  sendTypingAction,
  sendVoiceToOperator
} from "@/integrations/telegram.ts"
import { convertMp3ToOggOpus } from "@/lib/audio.ts"
import { log } from "@/lib/logger.ts"
import { nowISO } from "@/lib/time.ts"
import { pushRecentResponse, pushToActiveConversation, setGuardianResult } from "@/memory/working.ts"
import { handleGuardianVerdict, validateOutput } from "@/security/guardian.ts"
import type { CommunicationRegister } from "./types.ts"

interface MessagingResult {
  responseSent: boolean
  responseText?: string
}

async function getCurrentRegister(): Promise<CommunicationRegister> {
  const raw = await redis.get("working:communication:register")
  if (raw && typeof raw === "string" && ["casual", "playful", "terse", "elaborate", "raw"].includes(raw)) {
    return raw as CommunicationRegister
  }
  return "casual"
}

/**
 * Send ANIMA's messages to the operator via Telegram with guardian validation,
 * paragraph splitting, typing simulation, and occasional typos.
 */
export async function sendMessages(decision: AnimaDecision): Promise<MessagingResult> {
  const allTexts: string[] = []
  const register = await getCurrentRegister()

  for (const msg of decision.messages) {
    const guardianResult = await validateOutput(msg.text)
    await setGuardianResult(guardianResult)

    const { blocked } = await handleGuardianVerdict(guardianResult, "anima-message")
    if (blocked) {
      log.warn("Guardian blocked message", { text: msg.text.slice(0, 50) })
      continue
    }

    if (msg.asVoice && msg.voiceText) {
      try {
        await sendRecordVoiceAction()
        const mp3Buffer = await textToSpeech(msg.voiceText)
        const oggBuffer = await convertMp3ToOggOpus(mp3Buffer)
        const sentId = await sendVoiceToOperator(oggBuffer, msg.replyTo)

        await pushToActiveConversation([
          { role: "anima", text: msg.text, timestamp: nowISO(), messageId: sentId, isVoice: true }
        ])
      } catch (error) {
        log.warn("Voice send failed, falling back to text", { error: String(error) })
        const sentId = await sendMessageWithReply(msg.text, msg.replyTo)
        await pushToActiveConversation([{ role: "anima", text: msg.text, timestamp: nowISO(), messageId: sentId }])
      }
    } else {
      const { text: possiblyTypoed, correction } = maybeIntroduceTypo(msg.text, register)

      const paragraphs = splitIntoParagraphs(possiblyTypoed)
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

      if (correction) {
        const delay =
          TYPOS.CORRECTION_DELAY_MIN_MS +
          Math.random() * (TYPOS.CORRECTION_DELAY_MAX_MS - TYPOS.CORRECTION_DELAY_MIN_MS)
        await new Promise((resolve) => setTimeout(resolve, delay))
        await simulateTyping(computeTypingDuration(correction), sendTypingAction)
        const correctionId = await sendMessageWithReply(correction)
        await pushToActiveConversation([
          { role: "anima", text: correction, timestamp: nowISO(), messageId: correctionId }
        ])
      }
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
