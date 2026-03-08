import { describe, expect, it } from "vitest"
import {
  applyIdiolectDrift,
  buildIdiolectSection,
  detectOperatorAdoption,
  extractPatterns,
  mergePatterns
} from "./compute.ts"
import { DEFAULT_IDIOLECT_STATE, type IdiolectState } from "./types.ts"

describe("extractPatterns", () => {
  it("returns empty when too few messages", () => {
    const result = extractPatterns(["hi", "hey"])
    expect(result).toHaveLength(0)
  })

  it("detects filler words", () => {
    const messages = [
      "also ich weiß du, das ist halt so",
      "weißt du was ich meine halt",
      "also naja halt",
      "es ist halt irgendwie komisch",
      "also dann halt"
    ]
    const result = extractPatterns(messages)
    expect(result.some((p) => p.phrase === "halt")).toBe(true)
  })

  it("detects punctuation habits", () => {
    const messages = ["hey~", "das ist süß~", "okay~", "naja~", "schon klar~"]
    const result = extractPatterns(messages)
    expect(result.some((p) => p.type === "punctuation_habit" && p.phrase.includes("tilde"))).toBe(true)
  })

  it("detects ellipsis habits", () => {
    const messages = ["hmm...", "naja...", "okay...", "ich weiß nicht...", "vielleicht..."]
    const result = extractPatterns(messages)
    expect(result.some((p) => p.phrase.includes("ellipsis"))).toBe(true)
  })

  it("detects opening patterns", () => {
    const messages = ["also das ist spannend", "also ich dachte mir", "also naja", "also eigentlich", "also dann halt"]
    const result = extractPatterns(messages)
    expect(result.some((p) => p.type === "opening_phrase" && p.phrase === "also")).toBe(true)
  })
})

describe("detectOperatorAdoption", () => {
  it("detects frequently used operator phrases", () => {
    const operatorMessages = [
      "quasi genau das meine ich",
      "ja quasi",
      "das ist quasi perfekt",
      "quasi halt",
      "quasi so"
    ]
    const result = detectOperatorAdoption(operatorMessages, DEFAULT_IDIOLECT_STATE)
    expect(result.some((p) => p.phrase === "quasi" && p.adoptedFrom === "operator")).toBe(true)
  })

  it("does not adopt already known patterns", () => {
    const state: IdiolectState = {
      patterns: [
        {
          type: "filler_word",
          phrase: "quasi",
          frequency: 5,
          confidence: 0.5,
          adoptedFrom: "self",
          discoveredAt: ""
        }
      ],
      lastDriftAt: undefined
    }
    const operatorMessages = ["quasi genau", "quasi halt", "quasi so", "ja quasi", "quasi naja"]
    const result = detectOperatorAdoption(operatorMessages, state)
    expect(result.some((p) => p.phrase === "quasi")).toBe(false)
  })

  it("returns empty when too few messages", () => {
    const result = detectOperatorAdoption(["hi"], DEFAULT_IDIOLECT_STATE)
    expect(result).toHaveLength(0)
  })
})

describe("mergePatterns", () => {
  it("adds new patterns", () => {
    const pattern = {
      type: "filler_word" as const,
      phrase: "halt",
      frequency: 3,
      confidence: 0.24,
      adoptedFrom: "self" as const,
      discoveredAt: new Date().toISOString()
    }
    const result = mergePatterns(DEFAULT_IDIOLECT_STATE, [pattern])
    expect(result.patterns).toHaveLength(1)
    expect(result.patterns[0]?.phrase).toBe("halt")
  })

  it("increases confidence for existing patterns", () => {
    const state: IdiolectState = {
      patterns: [
        {
          type: "filler_word",
          phrase: "halt",
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
      phrase: "halt",
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
          phrase: "halt",
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
          phrase: "halt",
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
          phrase: "halt",
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
          phrase: "halt",
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
    expect(result).toContain("halt")
    expect(result).toContain("tilde")
  })

  it("marks operator-adopted patterns", () => {
    const state: IdiolectState = {
      patterns: [
        {
          type: "filler_word",
          phrase: "quasi",
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
})
