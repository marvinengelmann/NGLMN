import { TYPING } from "@/config/constants.ts"
import type { PendingMessage } from "@/integrations/types.ts"
import { sleep } from "@/lib/time.ts"

/**
 * Compute a realistic typing duration for a given text message.
 * Simulates ~180 WPM with thinking time and random jitter, clamped to 1.5s-15s.
 */
export function computeTypingDuration(text: string): number {
  const wordCount = text.split(/\s+/).filter(Boolean).length
  const typingMs = (wordCount / TYPING.WORDS_PER_MINUTE) * 60 * 1000
  const totalMs = typingMs + TYPING.BASE_THINKING_MS
  const jitter = 1 + (Math.random() * 2 - 1) * TYPING.JITTER_FACTOR
  const jitteredMs = totalMs * jitter

  return Math.max(TYPING.MIN_MS, Math.min(TYPING.MAX_MS, Math.round(jitteredMs)))
}

/**
 * Compute a realistic "reading time" for incoming messages.
 * Returns 1-3 seconds based on message count and total text length.
 */
export function computeReadTime(messages: PendingMessage[]): number {
  if (messages.length === 0) return 1000

  const totalChars = messages.reduce((sum, m) => sum + m.text.length, 0)
  const baseMs = 1000 + Math.min(2000, totalChars * 3)

  return Math.round(baseMs)
}

/**
 * Simulate typing by periodically sending "typing" chat action.
 * Refreshes the typing indicator every 5 seconds during the wait.
 */
export async function simulateTyping(durationMs: number, sendTypingAction: () => Promise<void>): Promise<void> {
  let remaining = durationMs

  while (remaining > 0) {
    await sendTypingAction()
    const waitTime = Math.min(remaining, TYPING.REFRESH_MS)
    await sleep(waitTime)
    remaining -= waitTime
  }
}
