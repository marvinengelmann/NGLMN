import { Resend } from "resend"
import { env } from "@/config/env.ts"
import type { AlertLevel, PendingEmail } from "@/integrations/types.ts"
import { log } from "@/lib/logger.ts"
import { getLastPolledEmailId, pushPendingEmails, setLastPolledEmailId } from "@/memory/working.ts"
import { sanitizeForContext } from "@/security/injection-defense.ts"

const resend = new Resend(env().RESEND_API_KEY)
const fromEmail = env().RESEND_FROM_EMAIL
const operatorEmail = env().RESEND_OPERATOR_EMAIL

/**
 * Send an email via Resend.
 * @param to - Recipient email address.
 * @param subject - Email subject line.
 * @param html - HTML body content.
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  await resend.emails.send({
    from: fromEmail,
    to,
    subject,
    html
  })
}

/**
 * Send an email to the configured operator address.
 * @param subject - Email subject line.
 * @param html - HTML body content.
 */
export async function sendEmailToOperator(subject: string, html: string): Promise<void> {
  await sendEmail(operatorEmail, subject, html)
}

/**
 * Poll Resend for new received emails and push them to the pending queue.
 * Uses cursor-based pagination via the `after` parameter.
 * @returns The number of new emails received.
 */
export async function pollNewEmails(): Promise<number> {
  const lastPolledId = await getLastPolledEmailId()

  const listParams: { limit?: number; after?: string } = { limit: 100 }
  if (lastPolledId) {
    listParams.after = lastPolledId
  }

  const { data: listResult, error: listError } = await resend.emails.receiving.list(listParams)

  if (listError || !listResult) {
    log.error("Email polling failed", { error: listError?.message ?? "no result" })
    return 0
  }

  const emailIds = listResult.data
  if (emailIds.length === 0) return 0

  const pendingEmails: PendingEmail[] = []

  for (const entry of emailIds) {
    const { data: email, error: getError } = await resend.emails.receiving.get(entry.id)

    if (getError || !email) {
      log.warn("Failed to fetch email", { emailId: entry.id, error: getError?.message ?? "no data" })
      continue
    }

    const recipients = Array.isArray(email.to) ? email.to : [String(email.to)]
    const isForAnima = recipients.some((addr) => addr.toLowerCase() === fromEmail.toLowerCase())
    if (!isForAnima) continue

    const rawText = email.text ?? email.html ?? ""
    const sanitizedText = sanitizeForContext(rawText)

    pendingEmails.push({
      emailId: email.id,
      from: typeof email.from === "string" ? email.from : String(email.from),
      to: Array.isArray(email.to) ? email.to : [String(email.to)],
      subject: email.subject ?? "(no subject)",
      text: sanitizedText,
      receivedAt: email.created_at
    })
  }

  const newestId = emailIds[0]?.id ?? ""
  await setLastPolledEmailId(newestId)

  await pushPendingEmails(pendingEmails)

  return pendingEmails.length
}

const ALERT_EMOJI: Record<AlertLevel, string> = {
  info: "\u2139\uFE0F",
  warning: "\u26A0\uFE0F",
  critical: "\uD83D\uDEA8",
  intervention: "\uD83D\uDD34"
}

/**
 * Send a formatted alert email to the operator.
 */
export async function sendEmailAlert(level: AlertLevel, message: string): Promise<void> {
  const emoji = ALERT_EMOJI[level]
  const prefix = level.toUpperCase()
  await sendEmailToOperator(`${emoji} [${prefix}] ANIMA Alert`, `<h2>${emoji} ${prefix}</h2><p>${message}</p>`)
}

/**
 * Check if the Resend API is reachable by listing domains.
 */
export async function pingResend(): Promise<boolean> {
  try {
    const { error } = await resend.domains.list()
    return !error
  } catch {
    return false
  }
}
