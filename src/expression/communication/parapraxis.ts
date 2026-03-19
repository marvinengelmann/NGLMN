import * as z from "zod"
import type { EmotionalState } from "@/affect/emotion/types.ts"
import type { SomaticState } from "@/affect/soma/types.ts"
import { callIntelligence } from "@/core/intelligence.ts"
import type { HeldBackBuffer } from "@/self/psyche/heldback.ts"
import { PARAPRAXIS } from "./constants.ts"

interface ParapraxisContext {
  emotion: EmotionalState
  soma: SomaticState
  heldBackBuffer: HeldBackBuffer
}

interface ParapraxisResult {
  text: string
  correction: string | null
  slipOccurred: boolean
}

const SlipOutput = z.object({
  slippedText: z.string(),
  correction: z.string().nullable()
})

const SLIP_PROMPT = `You are simulating a Freudian slip in a chat message. The speaker has a suppressed thought leaking into what they're saying.

You receive:
- The original message the speaker intended to send
- A suppressed fragment (something they held back but is now leaking through)

Your job: Rewrite the message so the suppressed fragment naturally bleeds into the text — as a mid-sentence derailment, a word substitution, a sudden tangent that gets caught and corrected, or a strikethrough (~~leaked words~~).

The slip should feel involuntary and natural — like the speaker's subconscious interrupted their typing. The result must be in the SAME LANGUAGE as the original message.

If the slip is obvious enough that the speaker would notice and correct themselves, provide a short, casual correction (in the same language). If it's subtle enough to go unnoticed, set correction to null.

Correction examples (adapt to the message language): "*[correct word]", "...forget I said that", "anyway—", "that's not what I—"

Keep the slipped message roughly the same length as the original. Don't over-explain the slip.`

function extractLeakFragment(entry: { content: string }): string {
  const words = entry.content.split(/\s+/)
  if (words.length <= 4) return entry.content
  const start = Math.floor(Math.random() * Math.max(1, words.length - 3))
  return words.slice(start, start + 2 + Math.floor(Math.random() * 2)).join(" ")
}

export async function maybeIntroduceSlip(text: string, context: ParapraxisContext): Promise<ParapraxisResult> {
  const { heldBackBuffer, emotion, soma } = context
  const noSlip = { text, correction: null, slipOccurred: false }

  if (heldBackBuffer.entries.length < PARAPRAXIS.MIN_BUFFER_ENTRIES) return noSlip
  if (text.length < PARAPRAXIS.MIN_TEXT_LENGTH) return noSlip

  const probability =
    PARAPRAXIS.BASE_PROBABILITY +
    heldBackBuffer.suppressionPressure * PARAPRAXIS.PRESSURE_WEIGHT +
    soma.tension * PARAPRAXIS.TENSION_WEIGHT +
    (1 - emotion.confidence) * PARAPRAXIS.CONFIDENCE_INVERSE_WEIGHT

  if (Math.random() >= probability) return noSlip

  const [first, ...rest] = heldBackBuffer.entries as [
    (typeof heldBackBuffer.entries)[0],
    ...typeof heldBackBuffer.entries
  ]
  const entry = rest.reduce((a, b) => (a.decayedCharge > b.decayedCharge ? a : b), first)
  const fragment = extractLeakFragment(entry)

  const result = await callIntelligence({
    system: SLIP_PROMPT,
    userMessage: `Original message: "${text}"\nSuppressed fragment: "${fragment}"`,
    schema: SlipOutput,
    reasoning: false,
    maxTokens: 256
  })

  if (result.isErr()) return noSlip

  return {
    text: result.value.slippedText,
    correction: result.value.correction,
    slipOccurred: true
  }
}
