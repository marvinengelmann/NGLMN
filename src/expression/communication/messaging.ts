import type { EmotionalState } from "@/affect/emotion/types.ts"
import type { SomaticState } from "@/affect/soma/types.ts"
import type { AnimaDecision } from "@/core/types.ts"
import { pushToActiveConversation } from "@/expression/communication/state.ts"
import {
  computeInterParagraphPause,
  computeTypingDuration,
  simulateTyping,
  splitIntoParagraphs
} from "@/expression/communication/timing.ts"
import { maybeIntroduceTypo } from "@/expression/communication/typos.ts"
import { generateAnimaImage } from "@/expression/image/generate.ts"
import { handleGuardianVerdict, validateOutput } from "@/governance/security/guardian.ts"
import { pushRecentResponse, setGuardianResult } from "@/governance/security/state.ts"
import { textToSpeech } from "@/infra/integrations/elevenlabs.ts"
import {
  sendMessageWithReply,
  sendPhotoToOperator,
  sendRecordVoiceAction,
  sendTypingAction,
  sendUploadPhotoAction,
  sendVoiceToOperator
} from "@/infra/integrations/telegram.ts"
import { convertMp3ToOggOpus } from "@/infra/lib/audio.ts"
import { log } from "@/infra/lib/logger.ts"
import { captureError } from "@/infra/lib/sentry.ts"
import { nowISO, sleep } from "@/infra/lib/time.ts"
import { MESSAGE_DELAY, TYPOS } from "./constants.ts"
import { getCommunicationRegister } from "./state.ts"

interface MessagingContext {
  emotion: EmotionalState
  soma: SomaticState
  vulnerabilityOpen: boolean
}

interface MessagingResult {
  responseSent: boolean
  responseText?: string
}

/**
 * Send ANIMA's messages to the operator via Telegram with guardian validation,
 * paragraph splitting, typing simulation, and occasional typos.
 */
export async function sendMessages(decision: AnimaDecision, context?: MessagingContext): Promise<MessagingResult> {
  const allTexts: string[] = []
  const register = (await getCommunicationRegister()) ?? "casual"

  await decision.messages.reduce(async (previousPromise, message, messageIndex) => {
    await previousPromise

    const guardianResult = await validateOutput(message.text)
    await setGuardianResult(guardianResult)

    const { blocked } = await handleGuardianVerdict(guardianResult, "anima-message")
    if (blocked) {
      log.warn("Guardian blocked message", { text: message.text.slice(0, 50) })
      return
    }

    if (message.withImage && message.imagePrompt) {
      try {
        await sendUploadPhotoAction()
        const imageResult = await generateAnimaImage(message.imagePrompt, message.imageSelf, message.imageAspectRatio)

        if (imageResult.isOk()) {
          const sentId = await sendPhotoToOperator(imageResult.value, message.text || undefined, message.replyTo)
          await pushToActiveConversation([
            { role: "anima", text: message.text || "[Image]", timestamp: nowISO(), messageId: sentId, hasImage: true }
          ])
        } else {
          captureError(imageResult.error.cause, { phase: "image_generation" })
          const sentId = await sendMessageWithReply(message.text, message.replyTo)
          await pushToActiveConversation([
            { role: "anima", text: message.text, timestamp: nowISO(), messageId: sentId }
          ])
        }
      } catch (error) {
        captureError(error, { phase: "image_send" })
        const sentId = await sendMessageWithReply(message.text, message.replyTo)
        await pushToActiveConversation([{ role: "anima", text: message.text, timestamp: nowISO(), messageId: sentId }])
      }
    } else if (message.asVoice && message.voiceText) {
      try {
        await sendRecordVoiceAction()
        const mp3Buffer = await textToSpeech(message.voiceText)
        const oggBuffer = await convertMp3ToOggOpus(mp3Buffer)
        const sentId = await sendVoiceToOperator(oggBuffer, message.replyTo)

        await pushToActiveConversation([
          { role: "anima", text: message.text, timestamp: nowISO(), messageId: sentId, isVoice: true }
        ])
      } catch (error) {
        captureError(error, { phase: "voice_send" })
        const sentId = await sendMessageWithReply(message.text, message.replyTo)
        await pushToActiveConversation([{ role: "anima", text: message.text, timestamp: nowISO(), messageId: sentId }])
      }
    } else {
      const { text: possiblyTypoed, correction } = maybeIntroduceTypo(
        message.text,
        register,
        context
          ? { emotion: context.emotion, soma: context.soma, vulnerabilityOpen: context.vulnerabilityOpen }
          : undefined
      )

      const paragraphs = splitIntoParagraphs(possiblyTypoed)
      await paragraphs.reduce(async (paragraphPromise, paragraph, i) => {
        await paragraphPromise

        if (!paragraph) return

        if (i > 0) {
          await sleep(computeInterParagraphPause())
        }

        await simulateTyping(computeTypingDuration(paragraph), sendTypingAction)
        const sentId = await sendMessageWithReply(paragraph, i === 0 ? message.replyTo : undefined)

        await pushToActiveConversation([{ role: "anima", text: paragraph, timestamp: nowISO(), messageId: sentId }])
      }, Promise.resolve())

      if (correction) {
        const delay =
          TYPOS.CORRECTION_DELAY_MIN_MS +
          Math.random() * (TYPOS.CORRECTION_DELAY_MAX_MS - TYPOS.CORRECTION_DELAY_MIN_MS)
        await sleep(delay)
        await simulateTyping(computeTypingDuration(correction), sendTypingAction)
        const correctionId = await sendMessageWithReply(correction)
        await pushToActiveConversation([
          { role: "anima", text: correction, timestamp: nowISO(), messageId: correctionId }
        ])
      }
    }

    allTexts.push(message.text)
    await pushRecentResponse(message.text)

    if (messageIndex < decision.messages.length - 1) {
      const delay = MESSAGE_DELAY.MIN_BETWEEN_MESSAGES_MS + Math.random() * MESSAGE_DELAY.MAX_JITTER_MS
      await sleep(delay)
    }
  }, Promise.resolve())

  return {
    responseSent: allTexts.length > 0,
    responseText: allTexts.join("\n")
  }
}
