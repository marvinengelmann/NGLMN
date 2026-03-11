import type { EmotionUpdateEvent } from "@/affect/emotion/types.ts"
import { nowISO } from "@/infra/lib/time.ts"
import { RELATIONAL_TRIGGERS } from "./constants.ts"
import type { OperatorModel, RelationalPattern, RelationalPatternLibrary } from "./types.ts"

interface MessageSignals {
  averageLength: number
  usesDots: boolean
  usesExclamation: boolean
  usesEmoji: boolean
  messageCount: number
  texts: string[]
}

/**
 * Extract observable signals from operator messages.
 */
export function extractSignals(texts: string[]): MessageSignals {
  if (texts.length === 0) {
    return { averageLength: 0, usesDots: false, usesExclamation: false, usesEmoji: false, messageCount: 0, texts }
  }

  const averageLength = texts.reduce((sum, t) => sum + t.length, 0) / texts.length
  const joined = texts.join(" ")

  return {
    averageLength,
    usesDots: /\.{3}|…/.test(joined),
    usesExclamation: /!{2,}/.test(joined),
    usesEmoji: /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u.test(joined),
    messageCount: texts.length,
    texts
  }
}

/**
 * Match current message signals against learned relational patterns
 * and generate emotion triggers for matching patterns.
 */
export function matchRelationalPatterns(
  signals: MessageSignals,
  _operatorModel: OperatorModel,
  library: RelationalPatternLibrary
): EmotionUpdateEvent[] {
  if (library.patterns.length === 0 || signals.messageCount === 0) return []

  return library.patterns
    .filter((pattern) => pattern.confidence >= RELATIONAL_TRIGGERS.MIN_MATCH_CONFIDENCE && checkPatternMatch(signals, pattern))
    .map((pattern) => ({
      trigger: "relational_pattern_match" as const,
      intensity: Math.min(
        RELATIONAL_TRIGGERS.MAX_TRIGGER_INTENSITY,
        pattern.confidence * RELATIONAL_TRIGGERS.CONFIDENCE_INTENSITY_SCALE
      ),
      detail: `${pattern.pattern} (${pattern.associatedMood}, confidence: ${pattern.confidence.toFixed(2)})`
    }))
}

function checkPatternMatch(signals: MessageSignals, pattern: RelationalPattern): boolean {
  switch (pattern.type) {
    case "punctuation_signal":
      if (pattern.pattern.includes("...") || pattern.pattern.includes("ellipsis")) return signals.usesDots
      if (pattern.pattern.includes("!!") || pattern.pattern.includes("exclamation")) return signals.usesExclamation
      return false

    case "message_length":
      if (pattern.associatedMood === "frustrated" || pattern.associatedMood === "tired")
        return signals.averageLength < RELATIONAL_TRIGGERS.SHORT_MESSAGE_THRESHOLD
      if (pattern.associatedMood === "excited" || pattern.associatedMood === "happy")
        return signals.averageLength > RELATIONAL_TRIGGERS.LONG_MESSAGE_THRESHOLD
      return false

    case "emoji_pattern": {
      const expectsEmoji = pattern.pattern.includes("uses emoji") || pattern.pattern.includes("with emoji")
      return expectsEmoji ? signals.usesEmoji : !signals.usesEmoji
    }

    case "word_choice":
      return signals.texts.some((t) => t.toLowerCase().includes(pattern.pattern.toLowerCase()))

    default:
      return false
  }
}

/**
 * Learn new patterns from observed operator behavior.
 * Called after operator model update to correlate signals with mood.
 */
export function learnFromObservation(
  signals: MessageSignals,
  operatorModel: OperatorModel,
  library: RelationalPatternLibrary
): RelationalPatternLibrary {
  if (signals.messageCount === 0) return library
  if (operatorModel.estimatedMood === "unknown") return library
  if (operatorModel.modelConfidence < RELATIONAL_TRIGGERS.MIN_LEARN_CONFIDENCE) return library

  const now = nowISO()
  const mood = operatorModel.estimatedMood
  const updatedPatterns = [...library.patterns]

  if (signals.usesDots && (mood === "sad" || mood === "tired")) {
    upsertPattern(updatedPatterns, {
      pattern: "uses ellipsis (...) when feeling down",
      type: "punctuation_signal",
      associatedMood: mood,
      confidence: 0,
      observations: 0,
      discoveredAt: now
    })
  }

  if (signals.usesExclamation && (mood === "excited" || mood === "happy")) {
    upsertPattern(updatedPatterns, {
      pattern: "uses exclamation marks (!!) when excited",
      type: "punctuation_signal",
      associatedMood: mood,
      confidence: 0,
      observations: 0,
      discoveredAt: now
    })
  }

  if (
    signals.averageLength < RELATIONAL_TRIGGERS.SHORT_MESSAGE_THRESHOLD &&
    (mood === "frustrated" || mood === "tired")
  ) {
    upsertPattern(updatedPatterns, {
      pattern: "sends short messages when frustrated or tired",
      type: "message_length",
      associatedMood: mood,
      confidence: 0,
      observations: 0,
      discoveredAt: now
    })
  }

  if (signals.averageLength > RELATIONAL_TRIGGERS.LONG_MESSAGE_THRESHOLD && (mood === "excited" || mood === "happy")) {
    upsertPattern(updatedPatterns, {
      pattern: "sends longer messages when happy or excited",
      type: "message_length",
      associatedMood: mood,
      confidence: 0,
      observations: 0,
      discoveredAt: now
    })
  }

  const trimmed = updatedPatterns.sort((a, b) => b.confidence - a.confidence).slice(0, RELATIONAL_TRIGGERS.MAX_PATTERNS)

  return { patterns: trimmed, lastUpdatedAt: now }
}

function upsertPattern(patterns: RelationalPattern[], candidate: Omit<RelationalPattern, "emotionalEffect">): void {
  const existing = patterns.find((p) => p.type === candidate.type && p.associatedMood === candidate.associatedMood)

  if (existing) {
    existing.observations++
    existing.confidence = Math.min(1, existing.observations * RELATIONAL_TRIGGERS.CONFIDENCE_PER_OBSERVATION)
    existing.lastMatchedAt = nowISO()
  } else {
    patterns.push({
      ...candidate,
      emotionalEffect: computeDefaultEffect(candidate.associatedMood),
      observations: 1,
      confidence: RELATIONAL_TRIGGERS.CONFIDENCE_PER_OBSERVATION
    })
  }
}

function computeDefaultEffect(mood: string): Record<string, number> {
  switch (mood) {
    case "happy":
      return { connection: 0.05, satisfaction: 0.03 }
    case "excited":
      return { excitement: 0.04, energy: 0.03 }
    case "sad":
      return { connection: 0.04, caution: 0.03, satisfaction: -0.02 }
    case "frustrated":
      return { caution: 0.05, frustration: 0.02, connection: -0.02 }
    case "stressed":
      return { caution: 0.04, connection: 0.02, energy: -0.02 }
    case "tired":
      return { energy: -0.03, connection: 0.02 }
    default:
      return {}
  }
}
