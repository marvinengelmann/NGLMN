import { Api, InputFile } from "grammy"
import { env } from "@/config/env.ts"
import { speechToText } from "@/integrations/elevenlabs.ts"
import { storeOperatorLocationFromTelegram } from "@/integrations/location.ts"
import { log } from "@/lib/logger.ts"
import { getLastUpdateId } from "@/memory/working.ts"
import type { DriftReport, GuardianResult } from "@/security/types.ts"
import type { AlertLevel, PendingMessage } from "./types.ts"

const bot = new Api(env().TELEGRAM_BOT_TOKEN)
const operatorChatId = env().TELEGRAM_OPERATOR_CHAT_ID

/**
 * Send a Markdown-formatted message to the operator via Telegram.
 * @param text - The message text to send.
 */
export async function sendToOperator(text: string): Promise<number> {
  const sent = await bot.sendMessage(operatorChatId, text, { parse_mode: "Markdown" })
  return sent.message_id
}

/**
 * Fetch new messages from Telegram via long polling without committing the offset.
 * @param timeout - Long poll timeout in seconds (Telegram holds the connection open).
 * @returns Parsed messages and the highest update ID (caller decides when to commit offset).
 */
export async function fetchNewMessages(timeout: number): Promise<{
  messages: PendingMessage[]
  maxUpdateId: number | null
}> {
  const lastUpdateId = await getLastUpdateId()

  const updates = await bot.getUpdates({
    offset: lastUpdateId != null ? lastUpdateId + 1 : undefined,
    timeout,
    allowed_updates: ["message"]
  })

  if (updates.length === 0) return { messages: [], maxUpdateId: null }

  const messages: PendingMessage[] = []

  for (const update of updates) {
    const telegramMessage = update.message
    if (!telegramMessage) continue

    if (telegramMessage.location && String(telegramMessage.chat.id) === operatorChatId) {
      await storeOperatorLocationFromTelegram(telegramMessage.location.latitude, telegramMessage.location.longitude)
      continue
    }

    if (telegramMessage.voice) {
      try {
        const audioBuffer = await downloadFile(telegramMessage.voice.file_id)
        const transcription = await speechToText(audioBuffer)
        messages.push({
          updateId: update.update_id,
          chatId: telegramMessage.chat.id,
          from: telegramMessage.from?.first_name ?? "Unknown",
          text: transcription,
          date: telegramMessage.date,
          messageId: telegramMessage.message_id,
          replyToText: telegramMessage.reply_to_message?.text,
          isVoice: true,
          voiceDurationSeconds: telegramMessage.voice.duration
        })
      } catch (error) {
        log.warn("Failed to transcribe voice message", { error: String(error) })
      }
      continue
    }

    if (!telegramMessage.text) continue

    messages.push({
      updateId: update.update_id,
      chatId: telegramMessage.chat.id,
      from: telegramMessage.from?.first_name ?? "Unknown",
      text: telegramMessage.text,
      date: telegramMessage.date,
      messageId: telegramMessage.message_id,
      replyToText: telegramMessage.reply_to_message?.text,
      isVoice: false
    })
  }

  const maxUpdateId = Math.max(...updates.map((update) => update.update_id))

  return { messages, maxUpdateId }
}

/**
 * Check if the Telegram bot API is reachable.
 */
export async function pingTelegram(): Promise<boolean> {
  try {
    const me = await bot.getMe()
    return !!me.id
  } catch {
    return false
  }
}

/**
 * Send a "typing" action to the operator chat.
 */
export async function sendTypingAction(): Promise<void> {
  await bot.sendChatAction(operatorChatId, "typing")
}

/**
 * Send a message with optional reply-to and return the sent message ID.
 */
export async function sendMessageWithReply(text: string, replyToMessageId?: number | null): Promise<number> {
  try {
    const sent = await bot.sendMessage(operatorChatId, text, {
      parse_mode: "Markdown",
      ...(replyToMessageId ? { reply_parameters: { message_id: replyToMessageId } } : {})
    })
    return sent.message_id
  } catch (error) {
    if (replyToMessageId && error instanceof Error && error.message.includes("message to be replied not found")) {
      const sent = await bot.sendMessage(operatorChatId, text, { parse_mode: "Markdown" })
      return sent.message_id
    }
    throw error
  }
}

/**
 * Send a system notification to the operator in italic.
 * Used for messages not consciously authored by ANIMA (trust blocks, errors, status updates).
 */
export async function sendSystemNotification(text: string): Promise<void> {
  await bot.sendMessage(operatorChatId, `_${escapeTelegramMarkdown(text)}_`, { parse_mode: "Markdown" })
}

/**
 * Escape Telegram MarkdownV1 special characters to prevent injection.
 */
export function escapeTelegramMarkdown(text: string): string {
  return text.replace(/[_*`[\]]/g, "\\$&")
}

const ALERT_EMOJI: Record<AlertLevel, string> = {
  info: "\u2139\uFE0F",
  warning: "\u26A0\uFE0F",
  critical: "\uD83D\uDEA8",
  intervention: "\uD83D\uDD34"
}

/**
 * Send a formatted alert to the operator with level-appropriate emoji prefix.
 */
export async function sendAlert(level: AlertLevel, message: string): Promise<void> {
  const emoji = ALERT_EMOJI[level]
  const prefix = level.toUpperCase()
  await bot.sendMessage(operatorChatId, `${emoji} *[${prefix}]* ${escapeTelegramMarkdown(message)}`, {
    parse_mode: "Markdown"
  })
}

/**
 * Send a Guardian alert when output is blocked or has warnings.
 */
export async function sendGuardianAlert(result: GuardianResult): Promise<void> {
  if (result.verdict === "approved") return

  const level: AlertLevel = result.verdict === "blocked" ? "critical" : "warning"
  const reasons = result.reasons.map((r) => `\u2022 ${r}`).join("\n")
  await sendAlert(level, `Guardian ${result.verdict}\n${reasons}`)
}

/**
 * Send a drift alert when the system is exhibiting anomalous behavior.
 */
export async function sendDriftAlert(report: DriftReport): Promise<void> {
  if (report.healthy) return

  const highSignals = report.signals.filter((s) => s.severity === "high")
  const details = report.signals.map((s) => `\u2022 [${s.severity}] ${s.type}: ${s.detail}`).join("\n")

  const level: AlertLevel = highSignals.length > 0 ? "critical" : "warning"
  await sendAlert(level, `Drift detected (${report.signals.length} signals)\n${details}`)
}

/**
 * Download a file from Telegram by file ID.
 * @param fileId - The Telegram file_id to download.
 * @returns File contents as a Buffer.
 */
export async function downloadFile(fileId: string): Promise<Buffer> {
  const file = await bot.getFile(fileId)
  const filePath = file.file_path
  if (!filePath) throw new Error("Telegram returned no file_path for file")

  const url = `https://api.telegram.org/file/bot${env().TELEGRAM_BOT_TOKEN}/${filePath}`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to download file: ${response.status}`)

  return Buffer.from(await response.arrayBuffer())
}

/**
 * Send a voice message (OGG/OPUS) to the operator.
 * @param oggBuffer - Audio in OGG/OPUS format.
 * @param replyToMessageId - Optional message ID to reply to.
 * @returns The sent message ID.
 */
export async function sendVoiceToOperator(oggBuffer: Buffer, replyToMessageId?: number): Promise<number> {
  const sent = await bot.sendVoice(operatorChatId, new InputFile(oggBuffer, "voice.ogg"), {
    ...(replyToMessageId ? { reply_parameters: { message_id: replyToMessageId } } : {})
  })
  return sent.message_id
}

/**
 * Send a "record_voice" chat action to simulate recording before sending a voice message.
 */
export async function sendRecordVoiceAction(): Promise<void> {
  await bot.sendChatAction(operatorChatId, "record_voice")
}
