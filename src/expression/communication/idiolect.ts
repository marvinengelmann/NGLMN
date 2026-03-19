import * as z from "zod"
import type { EmotionalState } from "@/affect/emotion/types.ts"
import { callIntelligence } from "@/core/intelligence.ts"
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

const LlmExtractedPatterns = z.object({
  fillerWords: z.array(z.object({ phrase: z.string(), count: z.number() })),
  openingPhrases: z.array(z.object({ phrase: z.string(), count: z.number() })),
  expressions: z.array(z.object({ phrase: z.string(), count: z.number() })),
  punctuationHabits: z.array(z.object({ description: z.string(), count: z.number() }))
})

const EXTRACT_PATTERNS_PROMPT = `Analyze these chat messages and extract recurring speech patterns. Be language-agnostic — detect patterns in whatever language the messages are written in.

Extract:
1. **Filler words**: Words or short phrases used as verbal fillers (e.g. "like", "basically", "you know", or equivalents in any language). Only include words that serve as fillers, not content words.
2. **Opening phrases**: Recurring ways messages begin (first 1-3 words).
3. **Expressions**: Distinctive phrases, catchphrases, or recurring multi-word expressions that characterize the speaker's voice.
4. **Punctuation habits**: Notable punctuation patterns (e.g. trailing tildes, excessive ellipses, em-dashes, missing periods, all lowercase).

For each pattern, provide the exact phrase as it appears and how many times it occurs. Only include patterns that appear at least 2 times. Be precise — count actual occurrences, don't estimate.`

/**
 * Extract potential idiolect patterns from messages using LLM analysis.
 * Language-agnostic — works with any language the messages are in.
 */
export async function extractPatterns(messages: string[], source: "self" | "operator" = "self"): Promise<IdiolectPattern[]> {
  if (messages.length < IDIOLECT.MIN_MESSAGES_FOR_EXTRACTION) return []

  const result = await callIntelligence({
    system: EXTRACT_PATTERNS_PROMPT,
    userMessage: messages.map((m, i) => `[${i + 1}] ${m}`).join("\n"),
    schema: LlmExtractedPatterns,
    reasoning: false,
    maxTokens: 1024
  })

  if (result.isErr()) return []

  const now = nowISO()
  const patterns: IdiolectPattern[] = []
  const extracted = result.value
  const initialConfidence = source === "operator" ? IDIOLECT.INITIAL_ADOPTED_CONFIDENCE : undefined

  extracted.fillerWords
    .filter((f) => f.count >= IDIOLECT.MIN_PHRASE_FREQUENCY)
    .forEach((f) => {
      patterns.push({
        type: "filler_word",
        phrase: f.phrase,
        frequency: f.count,
        confidence: initialConfidence ?? Math.min(1, f.count * IDIOLECT.CONFIDENCE_PER_USE),
        adoptedFrom: source,
        context: source === "operator" ? "adopted from operator" : undefined,
        discoveredAt: now
      })
    })

  extracted.openingPhrases
    .filter((o) => o.count >= IDIOLECT.MIN_PHRASE_FREQUENCY)
    .forEach((o) => {
      patterns.push({
        type: "opening_phrase",
        phrase: o.phrase,
        frequency: o.count,
        confidence: initialConfidence ?? Math.min(1, o.count * IDIOLECT.CONFIDENCE_PER_USE),
        adoptedFrom: source,
        context: source === "operator" ? "adopted from operator" : undefined,
        discoveredAt: now
      })
    })

  extracted.expressions
    .filter((e) => e.count >= IDIOLECT.MIN_PHRASE_FREQUENCY)
    .forEach((e) => {
      patterns.push({
        type: "expression",
        phrase: e.phrase,
        frequency: e.count,
        confidence: initialConfidence ?? Math.min(1, e.count * IDIOLECT.CONFIDENCE_PER_USE),
        adoptedFrom: source,
        context: source === "operator" ? "adopted from operator" : undefined,
        discoveredAt: now
      })
    })

  extracted.punctuationHabits
    .filter((p) => p.count >= IDIOLECT.MIN_PHRASE_FREQUENCY)
    .forEach((p) => {
      patterns.push({
        type: "punctuation_habit",
        phrase: p.description,
        frequency: p.count,
        confidence: initialConfidence ?? Math.min(1, p.count * IDIOLECT.CONFIDENCE_PER_USE),
        adoptedFrom: source,
        context: source === "operator" ? "adopted from operator" : undefined,
        discoveredAt: now
      })
    })

  return patterns
}

/**
 * Detect phrases ANIMA may have adopted from the operator's messages.
 */
export async function detectOperatorAdoption(operatorMessages: string[], currentState: IdiolectState): Promise<IdiolectPattern[]> {
  if (operatorMessages.length < 3) return []

  const patterns = await extractPatterns(operatorMessages, "operator")
  return patterns.filter((p) => !currentState.patterns.some((existing) => existing.phrase === p.phrase))
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
