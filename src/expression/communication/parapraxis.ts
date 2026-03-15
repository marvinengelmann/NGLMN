import type { EmotionalState } from "@/affect/emotion/types.ts"
import type { SomaticState } from "@/affect/soma/types.ts"
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

const SLIP_CORRECTIONS = [
  "...forget I said that",
  "anyway, what I meant was—",
  "sorry, I don't know where that came from",
  "ignore that",
  "that's not what I— nevermind"
]

function extractLeakFragment(entry: { content: string }): string {
  const words = entry.content.split(/\s+/)
  if (words.length <= 4) return entry.content
  const start = Math.floor(Math.random() * Math.max(1, words.length - 3))
  return words.slice(start, start + 2 + Math.floor(Math.random() * 2)).join(" ")
}

function applyStrikethroughSlip(text: string, fragment: string): string {
  return `~~${fragment}~~ ${text}`
}

function applyPivotSlip(text: string, fragment: string): string {
  const pivots = [
    `I wanted to say ${fragment}— no wait, ${text}`,
    `${fragment}— actually, ${text}`,
    `I— ${fragment}... anyway. ${text}`
  ]
  const pivot = pivots[Math.floor(Math.random() * pivots.length)]
  return pivot ?? pivots[0] ?? text
}

function applySubstitutionSlip(text: string, fragment: string): { slippedText: string; original: string } | null {
  const words = text.split(" ")
  if (words.length < 4) return null

  const fragmentWords = fragment.split(/\s+/)
  const insertWord = fragmentWords[Math.floor(Math.random() * fragmentWords.length)]
  if (!insertWord || insertWord.length < 3) return null

  const candidates = words
    .map((w, i) => ({ word: w, index: i }))
    .filter((w) => w.index > 0 && w.index < words.length - 1 && w.word.length >= 3 && !/[.!?,;:]/.test(w.word))

  if (candidates.length === 0) return null

  const target = candidates[Math.floor(Math.random() * candidates.length)]
  if (!target) return null
  const newWords = [...words]
  newWords[target.index] = insertWord

  return { slippedText: newWords.join(" "), original: target.word }
}

export function maybeIntroduceSlip(text: string, context: ParapraxisContext): ParapraxisResult {
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

  const entry = heldBackBuffer.entries.reduce((a, b) => (a.decayedCharge > b.decayedCharge ? a : b))
  const fragment = extractLeakFragment(entry)

  const roll = Math.random()

  if (roll < PARAPRAXIS.STRIKETHROUGH_PROBABILITY) {
    const slippedText = applyStrikethroughSlip(text, fragment)
    return { text: slippedText, correction: null, slipOccurred: true }
  }

  if (roll < PARAPRAXIS.STRIKETHROUGH_PROBABILITY + PARAPRAXIS.PIVOT_PROBABILITY) {
    const slippedText = applyPivotSlip(text, fragment)
    const correction = SLIP_CORRECTIONS[Math.floor(Math.random() * SLIP_CORRECTIONS.length)] ?? "...nevermind"
    return { text: slippedText, correction, slipOccurred: true }
  }

  const substitution = applySubstitutionSlip(text, fragment)
  if (!substitution) return noSlip

  const correction = `*${substitution.original}`
  return { text: substitution.slippedText, correction, slipOccurred: true }
}
