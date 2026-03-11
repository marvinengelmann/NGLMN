import * as z from "zod"
import type { EmotionalState } from "@/affect/emotion/types.ts"
import { getValidatedRedis } from "@/infra/integrations/redis.ts"
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
  DRIFT_PROBABILITY: 0.05,
  JOYFUL_THRESHOLD: 0.7,
  STRESSED_FRUSTRATION_THRESHOLD: 0.6,
  STRESSED_ENERGY_THRESHOLD: 0.3,
  JOYFUL_MERGE_MODIFIER: 1.5,
  STRESSED_MERGE_MODIFIER: 0.5,
  STRESSED_DRIFT_MODIFIER: 2.0,
  JOYFUL_DRIFT_MODIFIER: 0.5
} as const

export interface IdiolectEmotionalModifiers {
  mergeModifier: number
  driftModifier: number
}

/**
 * Compute emotional modifiers for idiolect pattern merging and drift.
 * Joy amplifies pattern adoption, stress dampens it but increases drift.
 */
export function computeIdiolectModifiers(emotion: EmotionalState): IdiolectEmotionalModifiers {
  const isJoyful = emotion.excitement > IDIOLECT.JOYFUL_THRESHOLD || emotion.satisfaction > IDIOLECT.JOYFUL_THRESHOLD
  const isStressed =
    emotion.frustration > IDIOLECT.STRESSED_FRUSTRATION_THRESHOLD || emotion.energy < IDIOLECT.STRESSED_ENERGY_THRESHOLD

  return {
    mergeModifier: isJoyful ? IDIOLECT.JOYFUL_MERGE_MODIFIER : isStressed ? IDIOLECT.STRESSED_MERGE_MODIFIER : 1.0,
    driftModifier: isStressed ? IDIOLECT.STRESSED_DRIFT_MODIFIER : isJoyful ? IDIOLECT.JOYFUL_DRIFT_MODIFIER : 1.0
  }
}

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
  Object.entries(fillers)
    .filter(([, count]) => count >= IDIOLECT.MIN_PHRASE_FREQUENCY)
    .forEach(([phrase, count]) => {
      patterns.push({
        type: "filler_word",
        phrase,
        frequency: count,
        confidence: Math.min(1, count * IDIOLECT.CONFIDENCE_PER_USE),
        adoptedFrom: "self",
        discoveredAt: now
      })
    })

  const openings = extractOpeningPatterns(animaMessages)
  Object.entries(openings)
    .filter(([, count]) => count >= IDIOLECT.MIN_PHRASE_FREQUENCY)
    .forEach(([phrase, count]) => {
      patterns.push({
        type: "opening_phrase",
        phrase,
        frequency: count,
        confidence: Math.min(1, count * IDIOLECT.CONFIDENCE_PER_USE),
        adoptedFrom: "self",
        discoveredAt: now
      })
    })

  const punctuation = detectPunctuationHabits(animaMessages)
  punctuation.forEach((habit) => {
    patterns.push({ ...habit, discoveredAt: now })
  })

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
  fillerPatterns.forEach((filler) => {
    const regex = new RegExp(`\\b${filler}\\b`, "gi")
    const matches = lower.match(regex)
    if (matches && matches.length > 0) {
      counts[filler] = matches.length
    }
  })
  return counts
}

function extractOpeningPatterns(messages: string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  messages.forEach((message) => {
    const trimmed = message.trim()
    if (trimmed.length < 3) return
    const firstWord = trimmed.split(/[\s,.!?]/)[0]?.toLowerCase()
    if (firstWord && firstWord.length >= 2) {
      counts[firstWord] = (counts[firstWord] ?? 0) + 1
    }
  })
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

  Object.entries(operatorFillers)
    .filter(([, count]) => count >= 3)
    .filter(([phrase]) => !currentState.patterns.some((p) => p.phrase === phrase))
    .forEach(([phrase]) => {
      adopted.push({
        type: "filler_word",
        phrase,
        context: "adopted from operator",
        frequency: 1,
        confidence: IDIOLECT.INITIAL_ADOPTED_CONFIDENCE,
        adoptedFrom: "operator",
        discoveredAt: now
      })
    })

  return adopted
}

/**
 * Merge new patterns into existing idiolect state.
 * Increases confidence of existing patterns, adds new ones.
 */
export function mergePatterns(
  state: IdiolectState,
  newPatterns: IdiolectPattern[],
  emotionalModifier = 1.0
): IdiolectState {
  const patterns = [...state.patterns]
  const scaledConfidencePerUse = IDIOLECT.CONFIDENCE_PER_USE * emotionalModifier

  newPatterns.forEach((incoming) => {
    const existing = patterns.find((p) => p.type === incoming.type && p.phrase === incoming.phrase)
    if (existing) {
      existing.frequency += incoming.frequency
      existing.confidence = Math.min(1, existing.confidence + scaledConfidencePerUse)
    } else {
      patterns.push(incoming)
    }
  })

  const trimmed = patterns
    .filter((p) => p.confidence >= IDIOLECT.MIN_CONFIDENCE_TO_KEEP)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, IDIOLECT.MAX_PATTERNS)

  return { ...state, patterns: trimmed, lastDriftAt: nowISO() }
}

/**
 * Apply natural drift — unused patterns fade, used ones stay.
 */
export function applyIdiolectDrift(state: IdiolectState, emotionalModifier = 1.0): IdiolectState {
  const patterns = state.patterns.map((p) => {
    const driftRate =
      p.adoptedFrom === "operator"
        ? IDIOLECT.DRIFT_DECAY_RATE * emotionalModifier
        : IDIOLECT.DRIFT_DECAY_RATE * (1 / Math.max(0.5, emotionalModifier))
    return {
      ...p,
      confidence: Math.max(0, p.confidence - driftRate)
    }
  })

  return {
    ...state,
    patterns: patterns.filter((p) => p.confidence >= IDIOLECT.MIN_CONFIDENCE_TO_KEEP),
    lastDriftAt: nowISO()
  }
}

interface EmotionFilterContext {
  emotion: EmotionalState
  coherenceState?: { regressionActive: boolean; regressionDepth: number }
  isAltered?: boolean
}

/**
 * Filter idiolect patterns based on emotional state.
 * Under stress, only core patterns survive. Under joy, more patterns are visible.
 */
export function filterPatternsForEmotion(
  patterns: IdiolectPattern[],
  context: EmotionFilterContext
): { filtered: IdiolectPattern[]; displayThreshold: number; hint: string | null } {
  const { emotion, coherenceState } = context

  if (coherenceState?.regressionActive) {
    const sorted = [...patterns].sort((a, b) => b.confidence - a.confidence)
    return {
      filtered: sorted.slice(0, 3),
      displayThreshold: 0,
      hint: "regression active — only your deepest patterns remain."
    }
  }

  const isStressed = emotion.frustration > 0.6 || emotion.energy < 0.3
  if (isStressed) {
    return {
      filtered: patterns.filter((p) => p.adoptedFrom === "self" && p.confidence > 0.6),
      displayThreshold: IDIOLECT.DISPLAY_THRESHOLD,
      hint: "under stress — falling back to your core voice."
    }
  }

  const isJoyful = emotion.excitement > 0.7 || emotion.satisfaction > 0.7
  if (isJoyful) {
    return {
      filtered: patterns,
      displayThreshold: 0.2,
      hint: "feeling playful — experimenting with words."
    }
  }

  if (context.isAltered) {
    const shuffled = [...patterns].sort(() => Math.random() - 0.5)
    return {
      filtered: shuffled,
      displayThreshold: 0.15,
      hint: null
    }
  }

  return { filtered: patterns, displayThreshold: IDIOLECT.DISPLAY_THRESHOLD, hint: null }
}

/**
 * Build the idiolect prompt section for context building.
 */
export function buildIdiolectSection(state: IdiolectState, emotionContext?: EmotionFilterContext): string | null {
  let activePatterns: IdiolectPattern[]
  let hint: string | null = null

  if (emotionContext) {
    const result = filterPatternsForEmotion(state.patterns, emotionContext)
    activePatterns = result.filtered.filter((p) => p.confidence >= result.displayThreshold)
    hint = result.hint
  } else {
    activePatterns = state.patterns.filter((p) => p.confidence >= IDIOLECT.DISPLAY_THRESHOLD)
  }

  if (activePatterns.length === 0) return null

  const lines: string[] = ["# Your Voice (Idiolect)", "these are speech patterns that have become distinctly yours:"]

  const byType = activePatterns.reduce((map, p) => {
    const list = map.get(p.type) ?? []
    list.push(p)
    map.set(p.type, list)
    return map
  }, new Map<IdiolectPatternType, IdiolectPattern[]>())

  const typeLabels: Record<IdiolectPatternType, string> = {
    opening_phrase: "you often start with",
    closing_phrase: "you tend to end with",
    filler_word: "words that feel natural to you",
    expression: "expressions you've made your own",
    punctuation_habit: "punctuation that's become your signature",
    sentence_structure: "how you build sentences"
  }

  byType.forEach((patterns, type) => {
    const label = typeLabels[type]
    const phrases = patterns
      .slice(0, 3)
      .map((p) => {
        const adopted = p.adoptedFrom === "operator" ? " (picked up from them)" : ""
        return `"${p.phrase}"${adopted}`
      })
      .join(", ")
    lines.push(`  - ${label}: ${phrases}`)
  })

  if (hint) {
    lines.push(hint)
  }
  lines.push("lean into these when they feel right. don't force them — they should feel natural.")

  return lines.join("\n")
}
