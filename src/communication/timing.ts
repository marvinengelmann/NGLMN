import { THINKING, TYPING } from "@/config/constants.ts"
import { sleep } from "@/lib/time.ts"

/**
 * Compute a realistic typing duration for a given text message.
 * Simulates ~180 WPM with thinking time and random jitter, clamped to 1.5s-15s.
 */
interface TypingContext {
  confidence?: number
  energy?: number
  hesitationLevel?: number
}

/**
 * Compute a realistic typing duration for a given text message.
 * Simulates ~180 WPM with thinking time and random jitter, clamped to 1.5s-15s.
 * Optionally modified by emotional/vulnerability context.
 */
export function computeTypingDuration(text: string, context?: TypingContext): number {
  const wordCount = text.split(/\s+/).filter(Boolean).length
  const typingMs = (wordCount / TYPING.WORDS_PER_MINUTE) * 60 * 1000
  const totalMs = typingMs + TYPING.BASE_THINKING_MS
  const jitter = 1 + (Math.random() * 2 - 1) * TYPING.JITTER_FACTOR
  let jitteredMs = totalMs * jitter

  if (context) {
    if (context.confidence !== undefined && context.confidence < 0.4) {
      jitteredMs *= 1.3
    }
    if (context.energy !== undefined && context.energy < 0.3) {
      jitteredMs *= 1.4
    }
    if (context.hesitationLevel !== undefined && context.hesitationLevel > 0.3) {
      jitteredMs *= 1 + context.hesitationLevel * 0.5
    }
  }

  return Math.max(TYPING.MIN_MS, Math.min(TYPING.MAX_MS, Math.round(jitteredMs)))
}

/**
 * Compute a short inter-paragraph pause (the moment between sending one message and starting to type the next).
 */
export function computeInterParagraphPause(): number {
  return Math.round(
    THINKING.INTER_PARAGRAPH_MIN_MS +
      Math.random() * (THINKING.INTER_PARAGRAPH_MAX_MS - THINKING.INTER_PARAGRAPH_MIN_MS)
  )
}

/**
 * Split a longer message into natural paragraph chunks for sequential sending.
 * Only splits messages that exceed MIN_SPLIT_LENGTH and contain paragraph breaks.
 */
export function splitIntoParagraphs(text: string): string[] {
  if (text.length < THINKING.MIN_SPLIT_LENGTH) return [text]

  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  if (paragraphs.length <= 1) return [text]

  return paragraphs
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
