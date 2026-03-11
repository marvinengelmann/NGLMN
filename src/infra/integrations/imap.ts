import { ImapFlow } from "imapflow"
import { env } from "@/infra/config/env.ts"
import { log } from "@/infra/lib/logger.ts"
import { EMAIL } from "./constants.ts"
import type { EmailPreview } from "./types.ts"

export function isImapEnabled(): boolean {
  const e = env()
  return !!(e.IMAP_HOST && e.IMAP_USER && e.IMAP_PASS)
}

function getImapConfig() {
  const e = env()
  if (!e.IMAP_HOST || !e.IMAP_USER || !e.IMAP_PASS) {
    throw new Error("IMAP not configured: IMAP_HOST, IMAP_USER, IMAP_PASS required")
  }
  return { host: e.IMAP_HOST, port: e.IMAP_PORT, user: e.IMAP_USER, pass: e.IMAP_PASS }
}

function createClient(): ImapFlow {
  const config = getImapConfig()
  return new ImapFlow({
    host: config.host,
    port: config.port,
    secure: true,
    auth: { user: config.user, pass: config.pass },
    logger: false
  })
}

function extractTextFromSource(source: Buffer): string {
  const raw = source.toString("utf-8")
  const boundaryMatch = raw.match(/boundary="?([^"\r\n]+)"?/)

  if (boundaryMatch?.[1]) {
    const boundary = boundaryMatch[1]
    const parts = raw.split(`--${boundary}`)
    const textPart = parts.find((part) => part.includes("Content-Type: text/plain"))
    if (textPart) {
      const bodyStart = textPart.indexOf("\r\n\r\n")
      if (bodyStart !== -1) {
        return textPart
          .slice(bodyStart + 4)
          .replace(/--$/, "")
          .trim()
      }
    }
  }

  const bodyStart = raw.indexOf("\r\n\r\n")
  if (bodyStart !== -1) {
    return raw.slice(bodyStart + 4).trim()
  }

  return ""
}

function formatSender(from: { name?: string; address?: string }[]): string {
  const sender = from[0]
  if (!sender) return "unknown"
  if (sender.name) return `${sender.name} <${sender.address}>`
  return sender.address ?? "unknown"
}

/**
 * Fetch unread emails from INBOX via IMAP.
 */
export async function fetchUnreadEmails(): Promise<EmailPreview[]> {
  const client = createClient()
  const emails: EmailPreview[] = []

  try {
    await client.connect()
    const lock = await client.getMailboxLock("INBOX")

    try {
      let count = 0
      for await (const message of client.fetch(
        { seen: false },
        {
          uid: true,
          envelope: true,
          source: true
        }
      )) {
        if (count >= EMAIL.MAX_PREVIEW_EMAILS) break
        if (!message.envelope) continue

        const snippet = message.source ? extractTextFromSource(message.source).slice(0, EMAIL.BODY_SNIPPET_LENGTH) : ""

        emails.push({
          uid: message.uid,
          from: formatSender(message.envelope.from ?? []),
          subject: message.envelope.subject ?? "(no subject)",
          date: message.envelope.date?.toISOString() ?? new Date().toISOString(),
          snippet
        })

        count++
      }
    } finally {
      lock.release()
    }

    await client.logout()
  } catch (e) {
    log.error("IMAP fetch failed", { error: e instanceof Error ? e.message : String(e) })
    try {
      await client.logout()
    } catch {}
    throw e
  }

  return emails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}
