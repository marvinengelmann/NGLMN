import type { EmotionalState } from "@/affect/emotion/types.ts"
import type { SomaticState } from "@/affect/soma/types.ts"
import type { AnimaDecision } from "@/core/types.ts"
import { maybeIntroduceSlip } from "@/expression/communication/parapraxis.ts"
import { pushToActiveConversation } from "@/expression/communication/state.ts"
import {
  computeInterParagraphPause,
  computeTypingDuration,
  simulateTyping,
  splitIntoParagraphs
} from "@/expression/communication/timing.ts"
import { maybeIntroduceTypo } from "@/expression/communication/typos.ts"
import { generateAnimaImage } from "@/expression/image/generate.ts"
import { buildAmbientVoiceMessage } from "@/expression/voice/mixing.ts"
import { handleGuardianVerdict, validateOutput } from "@/governance/security/guardian.ts"
import { pushRecentResponse, setGuardianResult } from "@/governance/security/state.ts"
import { textToSpeech } from "@/infra/integrations/elevenlabs.ts"
import {
  peekForNewMessages,
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
import { getGenesisVoiceId } from "@/self/genesis/state.ts"
import type { HeldBackBuffer } from "@/self/psyche/heldback.ts"
import { MESSAGE_DELAY, PARAPRAXIS, TYPOS } from "./constants.ts"
import { getCommunicationRegister } from "./state.ts"

interface MessagingContext {
  emotion: EmotionalState
  soma: SomaticState
  vulnerabilityOpen: boolean
  heldBackBuffer?: HeldBackBuffer
}

interface MessagingResult {
  responseSent: boolean
  responseText?: string
  interrupted: boolean
}

/**
 * Send ANIMA's messages to the operator via Telegram with guardian validation,
 * paragraph splitting, typing simulation, and occasional typos.
 */
export async function sendMessages(decision: AnimaDecision, context?: MessagingContext): Promise<MessagingResult> {
  const allTexts: string[] = []
  const register = (await getCommunicationRegister()) ?? "casual"
  let interrupted = false

  for (const [messageIndex, message] of decision.messages.entries()) {
    const guardianResult = await validateOutput(message.text)
    await setGuardianResult(guardianResult)

    const { blocked } = await handleGuardianVerdict(guardianResult, "anima-message")
    if (blocked) {
      log.warn("Guardian blocked message", { text: message.text.slice(0, 50) })
      continue
    }

    if (message.withImage && message.imagePrompt) {
      try {
        await sendUploadPhotoAction()
        const imageResult = await generateAnimaImage(
          message.imagePrompt,
          message.imageSelf,
          message.imageAspectRatio,
          message.imageContext
        )

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
    } else if (message.asVoice && message.backgroundSound && message.voiceSegments?.length) {
      try {
        await sendRecordVoiceAction()
        const { oggBuffer } = await buildAmbientVoiceMessage(
          message.voiceSegments,
          message.backgroundSound,
          message.backgroundSoundVolume
        )
        const sentId = await sendVoiceToOperator(oggBuffer, message.replyTo)

        await pushToActiveConversation([
          { role: "anima", text: message.text, timestamp: nowISO(), messageId: sentId, isVoice: true }
        ])
      } catch (error) {
        captureError(error, { phase: "ambient_voice_send" })
        const sentId = await sendMessageWithReply(message.text, message.replyTo)
        await pushToActiveConversation([{ role: "anima", text: message.text, timestamp: nowISO(), messageId: sentId }])
      }
    } else if (message.asVoice && message.voiceText) {
      try {
        await sendRecordVoiceAction()
        const voiceId = await getGenesisVoiceId()
        const mp3Buffer = await textToSpeech(message.voiceText, voiceId)
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

      const slipResult =
        context?.heldBackBuffer && context.emotion && context.soma
          ? maybeIntroduceSlip(possiblyTypoed, {
              emotion: context.emotion,
              soma: context.soma,
              heldBackBuffer: context.heldBackBuffer
            })
          : { text: possiblyTypoed, correction: null, slipOccurred: false }

      const paragraphs = splitIntoParagraphs(slipResult.text)

      for (const [paragraphIndex, paragraph] of paragraphs.entries()) {
        if (paragraphIndex > 0) {
          const hasNewMessages = await peekForNewMessages()
          if (hasNewMessages) {
            interrupted = true
            log.info("Mid-send interrupt detected between paragraphs")
            break
          }
          await sleep(computeInterParagraphPause())
        }

        await simulateTyping(computeTypingDuration(paragraph), sendTypingAction)
        const sentId = await sendMessageWithReply(paragraph, paragraphIndex === 0 ? message.replyTo : undefined)

        await pushToActiveConversation([{ role: "anima", text: paragraph, timestamp: nowISO(), messageId: sentId }])
      }

      if (!interrupted && correction) {
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

      if (!interrupted && slipResult.slipOccurred && slipResult.correction) {
        const delay =
          PARAPRAXIS.CORRECTION_DELAY_MIN_MS +
          Math.random() * (PARAPRAXIS.CORRECTION_DELAY_MAX_MS - PARAPRAXIS.CORRECTION_DELAY_MIN_MS)
        await sleep(delay)
        await simulateTyping(computeTypingDuration(slipResult.correction), sendTypingAction)
        const slipCorrectionId = await sendMessageWithReply(slipResult.correction)
        await pushToActiveConversation([
          { role: "anima", text: slipResult.correction, timestamp: nowISO(), messageId: slipCorrectionId }
        ])
      }
    }

    if (interrupted) break

    allTexts.push(message.text)
    await pushRecentResponse(message.text)

    if (messageIndex < decision.messages.length - 1) {
      const hasNewMessages = await peekForNewMessages()
      if (hasNewMessages) {
        interrupted = true
        log.info("Mid-send interrupt detected between messages")
        break
      }
      const delay = MESSAGE_DELAY.MIN_BETWEEN_MESSAGES_MS + Math.random() * MESSAGE_DELAY.MAX_JITTER_MS
      await sleep(delay)
    }
  }

  return {
    responseSent: allTexts.length > 0,
    responseText: allTexts.join("\n"),
    interrupted
  }
}
