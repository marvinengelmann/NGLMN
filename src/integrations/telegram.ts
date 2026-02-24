import { Api } from "grammy"
import { env } from "@/config/env.ts"
import { storeOperatorLocationFromTelegram } from "@/integrations/location.ts"
import { getLastUpdateId, pushPendingMessages, setLastUpdateId } from "@/memory/working.ts"
import type { DriftReport, GuardianResult } from "@/security/types.ts"
import type { AlertLevel, PendingMessage } from "./types.ts"

const bot = new Api(env().TELEGRAM_BOT_TOKEN)
const operatorChatId = env().TELEGRAM_OPERATOR_CHAT_ID

/**
 * Send a Markdown-formatted message to the operator via Telegram.
 * @param text - The message text to send.
 */
export async function sendToOperator(text: string): Promise<void> {
  await bot.sendMessage(operatorChatId, text, { parse_mode: "Markdown" })
}

/**
 * Poll Telegram for new messages and push them to the pending queue.
 * @returns The number of new messages received.
 */
export async function pollNewMessages(): Promise<number> {
  const lastUpdateId = await getLastUpdateId()

  const updates = await bot.getUpdates({
    offset: lastUpdateId != null ? lastUpdateId + 1 : undefined,
    timeout: 60,
    allowed_updates: ["message"]
  })

  if (updates.length === 0) return 0

  const messages: PendingMessage[] = []

  for (const update of updates) {
    const msg = update.message
    if (!msg) continue

    if (msg.location && String(msg.chat.id) === operatorChatId) {
      await storeOperatorLocationFromTelegram(msg.location.latitude, msg.location.longitude)
      continue
    }

    if (!msg.text) continue

    messages.push({
      updateId: update.update_id,
      chatId: msg.chat.id,
      from: msg.from?.first_name ?? "Unknown",
      text: msg.text,
      date: msg.date,
      messageId: msg.message_id
    })
  }

  const maxUpdateId = Math.max(...updates.map((u) => u.update_id))
  await setLastUpdateId(maxUpdateId)

  await pushPendingMessages(messages)

  return messages.length
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
export async function sendMessageWithReply(text: string, replyToMessageId?: number): Promise<number> {
  const sent = await bot.sendMessage(operatorChatId, text, {
    parse_mode: "Markdown",
    ...(replyToMessageId ? { reply_parameters: { message_id: replyToMessageId } } : {})
  })
  return sent.message_id
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
