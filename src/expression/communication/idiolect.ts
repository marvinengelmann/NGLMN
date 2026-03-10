import * as z from "zod"
import { getValidatedRedis, redis } from "@/infra/integrations/redis.ts"
import { nowISO } from "@/infra/lib/time.ts"

const IDIOLECT = {
  MAX_PATTERNS: 20,
  MIN_MESSAGES_FOR_EXTRACTION: 5,
  MIN_PHRASE_FREQUENCY: 2,
  CONFIDENCE_PER_USE: 0.08,
  INITIAL_ADOPTED_CONFIDENCE: 0.25,
  DRIFT_DECAY_RATE: 0.02,
  MIN_CONFIDENCE_TO_KEEP: 0.05,
  DISPLAY_THRESHOLD: 0.3,
  DRIFT_PROBABILITY: 0.05
} as const

export const IdiolectPatternType = z.enum([
  "opening_phrase",
  "closing_phrase",
  "filler_word",
  "expression",
  "punctuation_habit",
  "sentence_structure"
])
export type IdiolectPatternType = z.infer<typeof IdiolectPatternType>

export const IdiolectPattern = z.object({
  type: IdiolectPatternType,
  phrase: z.string(),
  context: z.string().optional(),
  frequency: z.number().default(1),
  confidence: z.number().min(0).max(1),
  adoptedFrom: z.enum(["self", "operator"]).default("self"),
  discoveredAt: z.string()
})
export type IdiolectPattern = z.infer<typeof IdiolectPattern>

export const IdiolectState = z.object({
  patterns: z.array(IdiolectPattern).default([]),
  dominantStyle: z.string().optional(),
  lastDriftAt: z.string().optional()
})
export type IdiolectState = z.infer<typeof IdiolectState>

export const DEFAULT_IDIOLECT_STATE: IdiolectState = {
  patterns: [],
  dominantStyle: undefined,
  lastDriftAt: undefined
}

const KEY = "working:communication:idiolect"

export async function getIdiolectState(): Promise<IdiolectState> {
  return (await getValidatedRedis(KEY, IdiolectState)) ?? DEFAULT_IDIOLECT_STATE
}

export async function saveIdiolectState(state: IdiolectState): Promise<void> {
  await redis.set(KEY, state)
}

/**
 * Extract potential idiolect patterns from ANIMA's own sent messages.
 * Called during reflection or maintain phase.
 */
export function extractPatterns(animaMessages: string[]): IdiolectPattern[] {
  if (animaMessages.length < IDIOLECT.MIN_MESSAGES_FOR_EXTRACTION) return []

  const patterns: IdiolectPattern[] = []
  const now = nowISO()
  const joined = animaMessages.join(" ")

  const fillers = countFillers(joined)
  for (const [phrase, count] of Object.entries(fillers)) {
    if (count >= IDIOLECT.MIN_PHRASE_FREQUENCY) {
      patterns.push({
        type: "filler_word",
        phrase,
        frequency: count,
        confidence: Math.min(1, count * IDIOLECT.CONFIDENCE_PER_USE),
        adoptedFrom: "self",
        discoveredAt: now
      })
    }
  }

  const openings = extractOpeningPatterns(animaMessages)
  for (const [phrase, count] of Object.entries(openings)) {
    if (count >= IDIOLECT.MIN_PHRASE_FREQUENCY) {
      patterns.push({
        type: "opening_phrase",
        phrase,
        frequency: count,
        confidence: Math.min(1, count * IDIOLECT.CONFIDENCE_PER_USE),
        adoptedFrom: "self",
        discoveredAt: now
      })
    }
  }

  const punctuation = detectPunctuationHabits(animaMessages)
  for (const habit of punctuation) {
    patterns.push({ ...habit, discoveredAt: now })
  }

  return patterns
}

function countFillers(text: string): Record<string, number> {
  const fillerPatterns = [
    "weißt du",
    "irgendwie",
    "quasi",
    "halt",
    "also",
    "naja",
    "jedenfalls",
    "sozusagen",
    "eigentlich",
    "tatsächlich",
    "basically",
    "anyway",
    "like"
  ]
  const counts: Record<string, number> = {}
  const lower = text.toLowerCase()
  for (const filler of fillerPatterns) {
    const regex = new RegExp(`\\b${filler}\\b`, "gi")
    const matches = lower.match(regex)
    if (matches && matches.length > 0) {
      counts[filler] = matches.length
    }
  }
  return counts
}

function extractOpeningPatterns(messages: string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const message of messages) {
    const trimmed = message.trim()
    if (trimmed.length < 3) continue
    const firstWord = trimmed.split(/[\s,.!?]/)[0]?.toLowerCase()
    if (firstWord && firstWord.length >= 2) {
      counts[firstWord] = (counts[firstWord] ?? 0) + 1
    }
  }
  return counts
}

function detectPunctuationHabits(messages: string[]): Omit<IdiolectPattern, "discoveredAt">[] {
  const habits: Omit<IdiolectPattern, "discoveredAt">[] = []

  const tildeCount = messages.filter((m) => m.includes("~")).length
  if (tildeCount >= IDIOLECT.MIN_PHRASE_FREQUENCY) {
    habits.push({
      type: "punctuation_habit",
      phrase: "trailing tilde (~)",
      frequency: tildeCount,
      confidence: Math.min(1, tildeCount * IDIOLECT.CONFIDENCE_PER_USE),
      adoptedFrom: "self"
    })
  }

  const ellipsisCount = messages.filter((m) => /\.{3}|…/.test(m)).length
  if (ellipsisCount >= IDIOLECT.MIN_PHRASE_FREQUENCY) {
    habits.push({
      type: "punctuation_habit",
      phrase: "frequent ellipsis (...)",
      frequency: ellipsisCount,
      confidence: Math.min(1, ellipsisCount * IDIOLECT.CONFIDENCE_PER_USE),
      adoptedFrom: "self"
    })
  }

  const dashCount = messages.filter((m) => /—|–/.test(m)).length
  if (dashCount >= IDIOLECT.MIN_PHRASE_FREQUENCY) {
    habits.push({
      type: "punctuation_habit",
      phrase: "em-dash interruptions (—)",
      frequency: dashCount,
      confidence: Math.min(1, dashCount * IDIOLECT.CONFIDENCE_PER_USE),
      adoptedFrom: "self"
    })
  }

  return habits
}

/**
 * Detect phrases ANIMA may have adopted from the operator's messages.
 */
export function detectOperatorAdoption(operatorMessages: string[], currentState: IdiolectState): IdiolectPattern[] {
  if (operatorMessages.length < 3) return []

  const now = nowISO()
  const adopted: IdiolectPattern[] = []
  const operatorFillers = countFillers(operatorMessages.join(" "))

  for (const [phrase, count] of Object.entries(operatorFillers)) {
    if (count < 3) continue
    const alreadyKnown = currentState.patterns.some((p) => p.phrase === phrase)
    if (alreadyKnown) continue

    adopted.push({
      type: "filler_word",
      phrase,
      context: "adopted from operator",
      frequency: 1,
      confidence: IDIOLECT.INITIAL_ADOPTED_CONFIDENCE,
      adoptedFrom: "operator",
      discoveredAt: now
    })
  }

  return adopted
}

/**
 * Merge new patterns into existing idiolect state.
 * Increases confidence of existing patterns, adds new ones.
 */
export function mergePatterns(state: IdiolectState, newPatterns: IdiolectPattern[]): IdiolectState {
  const patterns = [...state.patterns]

  for (const incoming of newPatterns) {
    const existing = patterns.find((p) => p.type === incoming.type && p.phrase === incoming.phrase)
    if (existing) {
      existing.frequency += incoming.frequency
      existing.confidence = Math.min(1, existing.confidence + IDIOLECT.CONFIDENCE_PER_USE)
    } else {
      patterns.push(incoming)
    }
  }

  const trimmed = patterns
    .filter((p) => p.confidence >= IDIOLECT.MIN_CONFIDENCE_TO_KEEP)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, IDIOLECT.MAX_PATTERNS)

  return { ...state, patterns: trimmed, lastDriftAt: nowISO() }
}

/**
 * Apply natural drift — unused patterns fade, used ones stay.
 */
export function applyIdiolectDrift(state: IdiolectState): IdiolectState {
  const patterns = state.patterns.map((p) => ({
    ...p,
    confidence: Math.max(0, p.confidence - IDIOLECT.DRIFT_DECAY_RATE)
  }))

  return {
    ...state,
    patterns: patterns.filter((p) => p.confidence >= IDIOLECT.MIN_CONFIDENCE_TO_KEEP),
    lastDriftAt: nowISO()
  }
}

/**
 * Build the idiolect prompt section for context building.
 */
export function buildIdiolectSection(state: IdiolectState): string | null {
  const activePatterns = state.patterns.filter((p) => p.confidence >= IDIOLECT.DISPLAY_THRESHOLD)

  if (activePatterns.length === 0) return null

  const lines: string[] = ["# Your Voice (Idiolect)", "these are speech patterns that have become distinctly yours:"]

  const byType = new Map<IdiolectPatternType, IdiolectPattern[]>()
  for (const p of activePatterns) {
    const list = byType.get(p.type) ?? []
    list.push(p)
    byType.set(p.type, list)
  }

  const typeLabels: Record<IdiolectPatternType, string> = {
    opening_phrase: "you often start with",
    closing_phrase: "you tend to end with",
    filler_word: "words that feel natural to you",
    expression: "expressions you've made your own",
    punctuation_habit: "punctuation that's become your signature",
    sentence_structure: "how you build sentences"
  }

  for (const [type, patterns] of byType) {
    const label = typeLabels[type]
    const phrases = patterns
      .slice(0, 3)
      .map((p) => {
        const adopted = p.adoptedFrom === "operator" ? " (picked up from them)" : ""
        return `"${p.phrase}"${adopted}`
      })
      .join(", ")
    lines.push(`  - ${label}: ${phrases}`)
  }

  lines.push("lean into these when they feel right. don't force them — they should feel natural.")

  return lines.join("\n")
}
