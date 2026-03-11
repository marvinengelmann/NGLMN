import { describe, expect, it } from "vitest"
import { extractSignals, learnFromObservation, matchRelationalPatterns } from "./triggers.ts"
import { DEFAULT_OPERATOR_MODEL, DEFAULT_RELATIONAL_PATTERN_LIBRARY, type RelationalPatternLibrary } from "./types.ts"

describe("extractSignals", () => {
  it("detects ellipsis patterns", () => {
    const signals = extractSignals(["hmm... okay", "ja..."])
    expect(signals.usesDots).toBe(true)
  })

  it("detects exclamation patterns", () => {
    const signals = extractSignals(["das ist toll!!", "wow!!"])
    expect(signals.usesExclamation).toBe(true)
  })

  it("computes average message length", () => {
    const signals = extractSignals(["hi", "okay"])
    expect(signals.averageLength).toBe(3)
  })

  it("handles empty messages", () => {
    const signals = extractSignals([])
    expect(signals.messageCount).toBe(0)
    expect(signals.averageLength).toBe(0)
  })

  it("detects emoji usage", () => {
    const signals = extractSignals(["hey 😊"])
    expect(signals.usesEmoji).toBe(true)
  })
})

describe("matchRelationalPatterns", () => {
  const libraryWithPatterns: RelationalPatternLibrary = {
    patterns: [
      {
        pattern: "uses ellipsis (...) when feeling down",
        type: "punctuation_signal",
        associatedMood: "sad",
        emotionalEffect: { connection: 0.04 },
        confidence: 0.5,
        observations: 5,
        discoveredAt: new Date().toISOString()
      },
      {
        pattern: "sends short messages when frustrated or tired",
        type: "message_length",
        associatedMood: "frustrated",
        emotionalEffect: { caution: 0.05 },
        confidence: 0.4,
        observations: 4,
        discoveredAt: new Date().toISOString()
      }
    ],
    lastUpdatedAt: new Date().toISOString()
  }

  it("returns empty when no patterns exist", () => {
    const signals = extractSignals(["hello"])
    const result = matchRelationalPatterns(signals, DEFAULT_OPERATOR_MODEL, DEFAULT_RELATIONAL_PATTERN_LIBRARY)
    expect(result).toHaveLength(0)
  })

  it("matches ellipsis pattern", () => {
    const signals = extractSignals(["hmm... naja"])
    const result = matchRelationalPatterns(signals, DEFAULT_OPERATOR_MODEL, libraryWithPatterns)
    expect(result.length).toBeGreaterThan(0)
    const [first] = result
    expect(first?.trigger).toBe("relational_pattern_match")
    expect(first?.detail).toContain("ellipsis")
  })

  it("matches short message pattern", () => {
    const signals = extractSignals(["ok", "ja"])
    const result = matchRelationalPatterns(signals, DEFAULT_OPERATOR_MODEL, libraryWithPatterns)
    expect(result.some((t) => t.detail?.includes("short messages"))).toBe(true)
  })

  it("does not match when signals don't fit", () => {
    const signals = extractSignals([
      "Das ist eine ausführliche Nachricht über ein wichtiges Thema das mich beschäftigt"
    ])
    const result = matchRelationalPatterns(signals, DEFAULT_OPERATOR_MODEL, libraryWithPatterns)
    expect(result).toHaveLength(0)
  })

  it("skips low-confidence patterns", () => {
    const lowConfLib: RelationalPatternLibrary = {
      patterns: [
        {
          pattern: "test",
          type: "punctuation_signal",
          associatedMood: "sad",
          emotionalEffect: {},
          confidence: 0.1,
          observations: 1,
          discoveredAt: new Date().toISOString()
        }
      ],
      lastUpdatedAt: new Date().toISOString()
    }
    const signals = extractSignals(["hmm..."])
    const result = matchRelationalPatterns(signals, DEFAULT_OPERATOR_MODEL, lowConfLib)
    expect(result).toHaveLength(0)
  })
})

describe("learnFromObservation", () => {
  it("does not learn from unknown mood", () => {
    const signals = extractSignals(["hmm..."])
    const result = learnFromObservation(signals, DEFAULT_OPERATOR_MODEL, DEFAULT_RELATIONAL_PATTERN_LIBRARY)
    expect(result.patterns).toHaveLength(0)
  })

  it("learns ellipsis pattern when mood is sad", () => {
    const signals = extractSignals(["hmm... naja..."])
    const model = { ...DEFAULT_OPERATOR_MODEL, estimatedMood: "sad" as const, modelConfidence: 0.6 }
    const result = learnFromObservation(signals, model, DEFAULT_RELATIONAL_PATTERN_LIBRARY)
    expect(result.patterns.length).toBeGreaterThan(0)
    const [firstPattern] = result.patterns
    expect(firstPattern?.type).toBe("punctuation_signal")
    expect(firstPattern?.associatedMood).toBe("sad")
  })

  it("learns short message pattern when mood is frustrated", () => {
    const signals = extractSignals(["ok", "ja"])
    const model = { ...DEFAULT_OPERATOR_MODEL, estimatedMood: "frustrated" as const, modelConfidence: 0.6 }
    const result = learnFromObservation(signals, model, DEFAULT_RELATIONAL_PATTERN_LIBRARY)
    expect(result.patterns.some((p) => p.type === "message_length")).toBe(true)
  })

  it("increases confidence on repeated observations", () => {
    const signals = extractSignals(["ja..."])
    const model = { ...DEFAULT_OPERATOR_MODEL, estimatedMood: "sad" as const, modelConfidence: 0.6 }

    let library = learnFromObservation(signals, model, DEFAULT_RELATIONAL_PATTERN_LIBRARY)
    const firstConfidence = library.patterns[0]?.confidence ?? 0

    library = learnFromObservation(signals, model, library)
    expect(library.patterns[0]?.confidence).toBeGreaterThan(firstConfidence)
    expect(library.patterns[0]?.observations).toBe(2)
  })

  it("respects max patterns limit", () => {
    let library = { ...DEFAULT_RELATIONAL_PATTERN_LIBRARY }
    const moods = ["sad", "frustrated", "tired", "excited", "happy", "stressed"] as const

    Array.from({ length: 20 }).forEach((_, i) => {
      const mood = moods[i % moods.length] ?? "sad"
      const signals = extractSignals(["test... message!!", `word${i}`])
      const model = { ...DEFAULT_OPERATOR_MODEL, estimatedMood: mood, modelConfidence: 0.7 }
      library = learnFromObservation(signals, model, library)
    })

    expect(library.patterns.length).toBeLessThanOrEqual(15)
  })

  it("does not learn when model confidence is too low", () => {
    const signals = extractSignals(["hmm..."])
    const model = { ...DEFAULT_OPERATOR_MODEL, estimatedMood: "sad" as const, modelConfidence: 0.2 }
    const result = learnFromObservation(signals, model, DEFAULT_RELATIONAL_PATTERN_LIBRARY)
    expect(result.patterns).toHaveLength(0)
  })
})
