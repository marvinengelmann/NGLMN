import { describe, expect, it, vi } from "vitest"
import { okAsync } from "neverthrow"
import { makeEmotionalState } from "@/test/factories.ts"
import {
  applyIdiolectDrift,
  buildIdiolectSection,
  DEFAULT_IDIOLECT_STATE,
  detectOperatorAdoption,
  extractPatterns,
  filterPatternsForEmotion,
  type IdiolectPattern,
  type IdiolectState,
  mergePatterns
} from "./idiolect.ts"

vi.mock("@/core/intelligence.ts", () => ({
  callIntelligence: vi.fn()
}))

async function mockLlmResponse(response: {
  fillerWords?: { phrase: string; count: number }[]
  openingPhrases?: { phrase: string; count: number }[]
  expressions?: { phrase: string; count: number }[]
  punctuationHabits?: { description: string; count: number }[]
}) {
  const { callIntelligence } = await import("@/core/intelligence.ts")
  vi.mocked(callIntelligence).mockReturnValue(
    okAsync({
      fillerWords: response.fillerWords ?? [],
      openingPhrases: response.openingPhrases ?? [],
      expressions: response.expressions ?? [],
      punctuationHabits: response.punctuationHabits ?? []
    }) as ReturnType<typeof callIntelligence>
  )
}

describe("extractPatterns", () => {
  it("returns empty when too few messages", async () => {
    const result = await extractPatterns(["hi", "hey"])
    expect(result).toHaveLength(0)
  })

  it("detects filler words via LLM", async () => {
    await mockLlmResponse({ fillerWords: [{ phrase: "basically", count: 4 }] })
    const messages = ["basically I think so", "yeah basically", "basically right", "so basically yeah", "okay then"]
    const result = await extractPatterns(messages)
    expect(result.some((p) => p.phrase === "basically" && p.type === "filler_word")).toBe(true)
  })

  it("detects punctuation habits via LLM", async () => {
    await mockLlmResponse({ punctuationHabits: [{ description: "trailing tilde (~)", count: 5 }] })
    const messages = ["hey~", "cool~", "okay~", "nice~", "sure~"]
    const result = await extractPatterns(messages)
    expect(result.some((p) => p.type === "punctuation_habit" && p.phrase.includes("tilde"))).toBe(true)
  })

  it("detects opening patterns via LLM", async () => {
    await mockLlmResponse({ openingPhrases: [{ phrase: "so", count: 4 }] })
    const messages = ["so anyway", "so I was thinking", "so yeah", "so basically", "okay then"]
    const result = await extractPatterns(messages)
    expect(result.some((p) => p.type === "opening_phrase" && p.phrase === "so")).toBe(true)
  })

  it("detects expressions via LLM", async () => {
    await mockLlmResponse({ expressions: [{ phrase: "you know what I mean", count: 3 }] })
    const messages = [
      "it was weird you know what I mean",
      "you know what I mean right",
      "yeah you know what I mean",
      "so that happened",
      "anyway"
    ]
    const result = await extractPatterns(messages)
    expect(result.some((p) => p.type === "expression")).toBe(true)
  })

  it("filters out patterns below minimum frequency", async () => {
    await mockLlmResponse({ fillerWords: [{ phrase: "like", count: 1 }] })
    const messages = ["like okay", "sure thing", "got it", "alright", "cool"]
    const result = await extractPatterns(messages)
    expect(result).toHaveLength(0)
  })
})

describe("detectOperatorAdoption", () => {
  it("detects operator patterns and marks them as adopted", async () => {
    await mockLlmResponse({ fillerWords: [{ phrase: "literally", count: 5 }] })
    const operatorMessages = [
      "literally the best",
      "I literally can't",
      "that's literally it",
      "literally what",
      "so literally yeah"
    ]
    const result = await detectOperatorAdoption(operatorMessages, DEFAULT_IDIOLECT_STATE)
    expect(result.some((p) => p.phrase === "literally" && p.adoptedFrom === "operator")).toBe(true)
  })

  it("does not adopt already known patterns", async () => {
    await mockLlmResponse({ fillerWords: [{ phrase: "basically", count: 4 }] })
    const state: IdiolectState = {
      patterns: [
        {
          type: "filler_word",
          phrase: "basically",
          frequency: 5,
          confidence: 0.5,
          adoptedFrom: "self",
          discoveredAt: ""
        }
      ],
      lastDriftAt: undefined
    }
    const operatorMessages = ["basically yes", "basically no", "basically right", "basically okay", "sure"]
    const result = await detectOperatorAdoption(operatorMessages, state)
    expect(result.some((p) => p.phrase === "basically")).toBe(false)
  })

  it("returns empty when too few messages", async () => {
    const result = await detectOperatorAdoption(["hi"], DEFAULT_IDIOLECT_STATE)
    expect(result).toHaveLength(0)
  })
})

describe("mergePatterns", () => {
  it("adds new patterns", () => {
    const pattern = {
      type: "filler_word" as const,
      phrase: "basically",
      frequency: 3,
      confidence: 0.24,
      adoptedFrom: "self" as const,
      discoveredAt: new Date().toISOString()
    }
    const result = mergePatterns(DEFAULT_IDIOLECT_STATE, [pattern])
    expect(result.patterns).toHaveLength(1)
    expect(result.patterns[0]?.phrase).toBe("basically")
  })

  it("increases confidence for existing patterns", () => {
    const state: IdiolectState = {
      patterns: [
        {
          type: "filler_word",
          phrase: "basically",
          frequency: 3,
          confidence: 0.3,
          adoptedFrom: "self",
          discoveredAt: ""
        }
      ],
      lastDriftAt: undefined
    }
    const incoming = {
      type: "filler_word" as const,
      phrase: "basically",
      frequency: 2,
      confidence: 0.16,
      adoptedFrom: "self" as const,
      discoveredAt: new Date().toISOString()
    }
    const result = mergePatterns(state, [incoming])
    expect(result.patterns).toHaveLength(1)
    expect(result.patterns[0]?.frequency).toBe(5)
    expect(result.patterns[0]?.confidence).toBeGreaterThan(0.3)
  })

  it("respects max patterns limit", () => {
    const patterns = Array.from({ length: 25 }, (_, i) => ({
      type: "expression" as const,
      phrase: `expression_${i}`,
      frequency: 1,
      confidence: 0.3,
      adoptedFrom: "self" as const,
      discoveredAt: new Date().toISOString()
    }))
    const result = mergePatterns(DEFAULT_IDIOLECT_STATE, patterns)
    expect(result.patterns.length).toBeLessThanOrEqual(20)
  })
})

describe("applyIdiolectDrift", () => {
  it("decays confidence", () => {
    const state: IdiolectState = {
      patterns: [
        {
          type: "filler_word",
          phrase: "basically",
          frequency: 3,
          confidence: 0.3,
          adoptedFrom: "self",
          discoveredAt: ""
        }
      ],
      lastDriftAt: undefined
    }
    const result = applyIdiolectDrift(state)
    expect(result.patterns[0]?.confidence).toBeLessThan(0.3)
  })

  it("removes patterns below minimum confidence", () => {
    const state: IdiolectState = {
      patterns: [
        {
          type: "filler_word",
          phrase: "basically",
          frequency: 1,
          confidence: 0.03,
          adoptedFrom: "self",
          discoveredAt: ""
        }
      ],
      lastDriftAt: undefined
    }
    const result = applyIdiolectDrift(state)
    expect(result.patterns).toHaveLength(0)
  })
})

describe("buildIdiolectSection", () => {
  it("returns null when no active patterns", () => {
    expect(buildIdiolectSection(DEFAULT_IDIOLECT_STATE)).toBeNull()
  })

  it("returns null when patterns below display threshold", () => {
    const state: IdiolectState = {
      patterns: [
        {
          type: "filler_word",
          phrase: "basically",
          frequency: 1,
          confidence: 0.1,
          adoptedFrom: "self",
          discoveredAt: ""
        }
      ],
      lastDriftAt: undefined
    }
    expect(buildIdiolectSection(state)).toBeNull()
  })

  it("includes patterns above display threshold", () => {
    const state: IdiolectState = {
      patterns: [
        {
          type: "filler_word",
          phrase: "basically",
          frequency: 5,
          confidence: 0.5,
          adoptedFrom: "self",
          discoveredAt: ""
        },
        {
          type: "punctuation_habit",
          phrase: "trailing tilde (~)",
          frequency: 8,
          confidence: 0.6,
          adoptedFrom: "self",
          discoveredAt: ""
        }
      ],
      lastDriftAt: undefined
    }
    const result = buildIdiolectSection(state)
    expect(result).toContain("# Your Voice")
    expect(result).toContain("basically")
    expect(result).toContain("tilde")
  })

  it("marks operator-adopted patterns", () => {
    const state: IdiolectState = {
      patterns: [
        {
          type: "filler_word",
          phrase: "literally",
          frequency: 3,
          confidence: 0.4,
          adoptedFrom: "operator",
          discoveredAt: ""
        }
      ],
      lastDriftAt: undefined
    }
    const result = buildIdiolectSection(state)
    expect(result).toContain("picked up from them")
  })

  it("filters patterns by emotion context when provided", () => {
    const state: IdiolectState = {
      patterns: [
        { type: "filler_word", phrase: "basically", frequency: 5, confidence: 0.8, adoptedFrom: "self", discoveredAt: "" },
        {
          type: "filler_word",
          phrase: "literally",
          frequency: 3,
          confidence: 0.4,
          adoptedFrom: "operator",
          discoveredAt: ""
        }
      ],
      lastDriftAt: undefined
    }
    const result = buildIdiolectSection(state, {
      emotion: makeEmotionalState({ frustration: 0.8 }),
      coherenceState: { regressionActive: false, regressionDepth: 0 }
    })
    expect(result).toContain("basically")
    expect(result).not.toContain("literally")
  })

  it("adds stress hint when under stress", () => {
    const state: IdiolectState = {
      patterns: [
        { type: "filler_word", phrase: "basically", frequency: 5, confidence: 0.8, adoptedFrom: "self", discoveredAt: "" }
      ],
      lastDriftAt: undefined
    }
    const result = buildIdiolectSection(state, {
      emotion: makeEmotionalState({ frustration: 0.8 }),
      coherenceState: { regressionActive: false, regressionDepth: 0 }
    })
    expect(result).toContain("core voice")
  })
})

describe("filterPatternsForEmotion", () => {
  const selfPattern: IdiolectPattern = {
    type: "filler_word",
    phrase: "basically",
    frequency: 5,
    confidence: 0.8,
    adoptedFrom: "self",
    discoveredAt: ""
  }
  const adoptedPattern: IdiolectPattern = {
    type: "filler_word",
    phrase: "literally",
    frequency: 3,
    confidence: 0.4,
    adoptedFrom: "operator",
    discoveredAt: ""
  }
  const weakSelfPattern: IdiolectPattern = {
    type: "expression",
    phrase: "anyway",
    frequency: 2,
    confidence: 0.25,
    adoptedFrom: "self",
    discoveredAt: ""
  }

  it("under stress: only keeps self patterns with high confidence", () => {
    const result = filterPatternsForEmotion([selfPattern, adoptedPattern, weakSelfPattern], {
      emotion: makeEmotionalState({ frustration: 0.7 })
    })
    expect(result.filtered).toHaveLength(1)
    expect(result.filtered[0]?.phrase).toBe("basically")
    expect(result.hint).toContain("core voice")
  })

  it("under regression: keeps only top 3 by confidence", () => {
    const patterns: IdiolectPattern[] = Array.from({ length: 5 }, (_, i) => ({
      type: "filler_word" as const,
      phrase: `p${i}`,
      frequency: 1,
      confidence: 0.3 + i * 0.1,
      adoptedFrom: "self" as const,
      discoveredAt: ""
    }))
    const result = filterPatternsForEmotion(patterns, {
      emotion: makeEmotionalState(),
      coherenceState: { regressionActive: true, regressionDepth: 0.5 }
    })
    expect(result.filtered).toHaveLength(3)
    expect(result.filtered[0]?.confidence).toBeGreaterThanOrEqual(result.filtered[2]?.confidence ?? 0)
    expect(result.hint).toContain("regression")
  })

  it("under joy: shows all patterns with lowered threshold", () => {
    const result = filterPatternsForEmotion([selfPattern, adoptedPattern, weakSelfPattern], {
      emotion: makeEmotionalState({ excitement: 0.8 })
    })
    expect(result.filtered).toHaveLength(3)
    expect(result.displayThreshold).toBe(0.2)
    expect(result.hint).toContain("playful")
  })

  it("in altered state: randomizes order and lowers threshold", () => {
    const result = filterPatternsForEmotion([selfPattern, adoptedPattern], {
      emotion: makeEmotionalState(),
      isAltered: true
    })
    expect(result.filtered).toHaveLength(2)
    expect(result.displayThreshold).toBe(0.15)
    expect(result.hint).toBeNull()
  })

  it("in neutral state: returns all patterns with standard threshold", () => {
    const result = filterPatternsForEmotion([selfPattern, adoptedPattern], {
      emotion: makeEmotionalState()
    })
    expect(result.filtered).toHaveLength(2)
    expect(result.displayThreshold).toBe(0.3)
    expect(result.hint).toBeNull()
  })
})

describe("mergePatterns with emotionalModifier", () => {
  const makeState = (): IdiolectState => ({
    patterns: [
      { type: "filler_word", phrase: "basically", frequency: 3, confidence: 0.3, adoptedFrom: "self", discoveredAt: "" }
    ],
    lastDriftAt: undefined
  })

  const makeIncoming = () => ({
    type: "filler_word" as const,
    phrase: "basically",
    frequency: 1,
    confidence: 0.1,
    adoptedFrom: "self" as const,
    discoveredAt: new Date().toISOString()
  })

  it("increases confidence faster with joy modifier", () => {
    const normalResult = mergePatterns(makeState(), [makeIncoming()], 1.0)
    const joyResult = mergePatterns(makeState(), [makeIncoming()], 1.5)
    expect(joyResult.patterns[0]?.confidence).toBeGreaterThan(normalResult.patterns[0]?.confidence ?? 0)
  })

  it("increases confidence slower with stress modifier", () => {
    const normalResult = mergePatterns(makeState(), [makeIncoming()], 1.0)
    const stressResult = mergePatterns(makeState(), [makeIncoming()], 0.5)
    expect(stressResult.patterns[0]?.confidence).toBeLessThan(normalResult.patterns[0]?.confidence ?? 0)
  })
})

describe("applyIdiolectDrift with emotionalModifier", () => {
  it("adopted patterns drift faster under stress modifier", () => {
    const makeState = (): IdiolectState => ({
      patterns: [
        {
          type: "filler_word",
          phrase: "literally",
          frequency: 3,
          confidence: 0.3,
          adoptedFrom: "operator",
          discoveredAt: ""
        }
      ],
      lastDriftAt: undefined
    })
    const normalResult = applyIdiolectDrift(makeState(), 1.0)
    const stressResult = applyIdiolectDrift(makeState(), 2.0)
    expect(stressResult.patterns[0]?.confidence ?? 0).toBeLessThan(normalResult.patterns[0]?.confidence ?? 0)
  })

  it("adopted patterns drift slower under joy modifier", () => {
    const makeState = (): IdiolectState => ({
      patterns: [
        {
          type: "filler_word",
          phrase: "literally",
          frequency: 3,
          confidence: 0.3,
          adoptedFrom: "operator",
          discoveredAt: ""
        }
      ],
      lastDriftAt: undefined
    })
    const normalResult = applyIdiolectDrift(makeState(), 1.0)
    const joyResult = applyIdiolectDrift(makeState(), 0.5)
    expect(joyResult.patterns[0]?.confidence ?? 0).toBeGreaterThan(normalResult.patterns[0]?.confidence ?? 0)
  })
})
