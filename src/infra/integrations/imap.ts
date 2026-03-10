import { ImapFlow } from "imapflow"
import { env } from "@/infra/config/env.ts"
import { log } from "@/infra/lib/logger.ts"
import { EMAIL } from "./constants.ts"
import type { EmailPreview } from "./types.ts"

export function isImapEnabled(): boolean {
  return !!(process.env.IMAP_HOST && process.env.IMAP_USER && process.env.IMAP_PASS)
}

function createClient(): ImapFlow {
  return new ImapFlow({
    host: env().IMAP_HOST as string,
    port: env().IMAP_PORT,
    secure: true,
    auth: {
      user: env().IMAP_USER as string,
      pass: env().IMAP_PASS as string
    },
    logger: false
  })
}

function extractTextFromSource(source: Buffer): string {
  const raw = source.toString("utf-8")
  const boundaryMatch = raw.match(/boundary="?([^"\r\n]+)"?/)

  if (boundaryMatch?.[1]) {
    const boundary = boundaryMatch[1]
    const parts = raw.split(`--${boundary}`)
    for (const part of parts) {
      if (part.includes("Content-Type: text/plain")) {
        const bodyStart = part.indexOf("\r\n\r\n")
        if (bodyStart !== -1) {
          return part
            .slice(bodyStart + 4)
            .replace(/--$/, "")
            .trim()
        }
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
