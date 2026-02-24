vi.mock("@/config/env.ts", () => ({
  env: vi.fn()
}))

import { env } from "@/config/env.ts"
import { DEFAULT_EMOTIONAL_STATE } from "@/emotion/types.ts"
import { PERSONALITY_CENTER } from "@/personality/types.ts"
import {
  getEmotionBaseline,
  getMbtiType,
  mbtiFlavorText,
  mbtiToEmotionBaseline,
  mbtiToPersonality,
  parseMbtiType
} from "./mbti.ts"

const mockEnv = env as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.resetAllMocks()
})

describe("parseMbtiType", () => {
  const ALL_16_TYPES = [
    "ISTJ",
    "ISFJ",
    "INFJ",
    "INTJ",
    "ISTP",
    "ISFP",
    "INFP",
    "INTP",
    "ESTP",
    "ESFP",
    "ENFP",
    "ENTP",
    "ESTJ",
    "ESFJ",
    "ENFJ",
    "ENTJ"
  ]

  it.each(ALL_16_TYPES)("parses %s correctly", (type) => {
    const result = parseMbtiType(type)
    expect(result).not.toBeNull()
    expect(result?.ei).toBe(type[0])
    expect(result?.sn).toBe(type[1])
    expect(result?.tf).toBe(type[2])
    expect(result?.jp).toBe(type[3])
    expect(result?.at).toBeUndefined()
  })

  it("parses -A suffix", () => {
    const result = parseMbtiType("INFP-A")
    expect(result?.at).toBe("A")
  })

  it("parses -T suffix", () => {
    const result = parseMbtiType("INFP-T")
    expect(result?.at).toBe("T")
  })

  it("handles lowercase input", () => {
    const result = parseMbtiType("infp-t")
    expect(result).not.toBeNull()
    expect(result?.ei).toBe("I")
    expect(result?.at).toBe("T")
  })

  it("handles whitespace", () => {
    const result = parseMbtiType("  INFP-T  ")
    expect(result).not.toBeNull()
  })

  it("returns null for invalid strings", () => {
    expect(parseMbtiType("")).toBeNull()
    expect(parseMbtiType("XXXX")).toBeNull()
    expect(parseMbtiType("INF")).toBeNull()
    expect(parseMbtiType("INFPP")).toBeNull()
    expect(parseMbtiType("INFP-X")).toBeNull()
    expect(parseMbtiType("hello")).toBeNull()
  })
})

describe("mbtiToPersonality", () => {
  it("returns INFP-T personality with correct 10-dim delta application", () => {
    const result = mbtiToPersonality("INFP-T")
    expect(result.directness).toBeCloseTo(0.07)
    expect(result.curiosity).toBeCloseTo(0.8)
    expect(result.humor).toBeCloseTo(0.66)
    expect(result.caution).toBeCloseTo(0.66)
    expect(result.proactivity).toBeCloseTo(0.17)
    expect(result.verbosity).toBeCloseTo(0.25)
    expect(result.warmth).toBeCloseTo(0.63)
    expect(result.structure).toBeCloseTo(0.07)
    expect(result.empathy).toBeCloseTo(0.83)
    expect(result.abstraction).toBeCloseTo(0.83)
  })

  it("returns ESTJ-A personality with correct 10-dim delta application", () => {
    const result = mbtiToPersonality("ESTJ-A")
    expect(result.directness).toBeCloseTo(0.93)
    expect(result.curiosity).toBeCloseTo(0.2)
    expect(result.humor).toBeCloseTo(0.34)
    expect(result.caution).toBeCloseTo(0.34)
    expect(result.proactivity).toBeCloseTo(0.83)
    expect(result.verbosity).toBeCloseTo(0.75)
    expect(result.warmth).toBeCloseTo(0.37)
    expect(result.structure).toBeCloseTo(0.93)
    expect(result.empathy).toBeCloseTo(0.25)
    expect(result.abstraction).toBeCloseTo(0.17)
  })

  it("new dimensions show strong contrast between INFP-T and ESTJ-A", () => {
    const infp = mbtiToPersonality("INFP-T")
    const estj = mbtiToPersonality("ESTJ-A")
    expect(Math.abs(infp.structure - estj.structure)).toBeGreaterThan(0.4)
    expect(Math.abs(infp.empathy - estj.empathy)).toBeGreaterThan(0.4)
    expect(Math.abs(infp.abstraction - estj.abstraction)).toBeGreaterThan(0.4)
  })

  it("clamps values to [0, 1]", () => {
    const result = mbtiToPersonality("INFP-T")
    for (const value of Object.values(result)) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })

  it("opposite types diverge significantly on extraversion dims", () => {
    const infp = mbtiToPersonality("INFP")
    const estj = mbtiToPersonality("ESTJ")
    expect(Math.abs(infp.directness - estj.directness)).toBeGreaterThan(0.2)
    expect(Math.abs(infp.proactivity - estj.proactivity)).toBeGreaterThan(0.2)
  })

  it("returns PERSONALITY_CENTER for invalid input", () => {
    const result = mbtiToPersonality("INVALID")
    expect(result).toEqual(PERSONALITY_CENTER)
  })

  it("without suffix differs from with suffix", () => {
    const base = mbtiToPersonality("INFP")
    const assertive = mbtiToPersonality("INFP-A")
    const turbulent = mbtiToPersonality("INFP-T")
    expect(assertive.directness).not.toEqual(turbulent.directness)
    expect(base.directness).not.toEqual(assertive.directness)
  })

  it("produces all 10 dimensions", () => {
    const result = mbtiToPersonality("INFP-T")
    const keys = Object.keys(result)
    expect(keys).toHaveLength(10)
    expect(keys).toContain("structure")
    expect(keys).toContain("empathy")
    expect(keys).toContain("abstraction")
  })
})

describe("mbtiToEmotionBaseline", () => {
  it("returns shifted baseline for INFP-T", () => {
    const result = mbtiToEmotionBaseline("INFP-T")
    expect(result.curiosity).toBeGreaterThan(DEFAULT_EMOTIONAL_STATE.curiosity)
    expect(result.frustration).toBeGreaterThan(DEFAULT_EMOTIONAL_STATE.frustration)
    expect(result.boredom).toBeGreaterThan(DEFAULT_EMOTIONAL_STATE.boredom)
  })

  it("returns shifted baseline for ESTJ-A", () => {
    const result = mbtiToEmotionBaseline("ESTJ-A")
    expect(result.excitement).toBeGreaterThan(DEFAULT_EMOTIONAL_STATE.excitement)
    expect(result.satisfaction).toBeGreaterThan(DEFAULT_EMOTIONAL_STATE.satisfaction)
    expect(result.connection).toBeGreaterThan(DEFAULT_EMOTIONAL_STATE.connection)
  })

  it("clamps values to [0, 1]", () => {
    const result = mbtiToEmotionBaseline("INFP-T")
    for (const value of Object.values(result)) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })

  it("returns DEFAULT_EMOTIONAL_STATE for invalid input", () => {
    const result = mbtiToEmotionBaseline("INVALID")
    expect(result).toEqual(DEFAULT_EMOTIONAL_STATE)
  })
})

describe("mbtiFlavorText", () => {
  it("contains the type string", () => {
    const result = mbtiFlavorText("INFP-T")
    expect(result).toContain("INFP-T")
  })

  it("contains all dichotomy descriptions for INFP-T", () => {
    const result = mbtiFlavorText("INFP-T")
    expect(result).toContain("inner reflection")
    expect(result).toContain("patterns, possibilities")
    expect(result).toContain("emotions and values")
    expect(result).toContain("flexibility, spontaneity")
    expect(result).toContain("emotionally sensitive")
  })

  it("contains extroversion description for E types", () => {
    const result = mbtiFlavorText("ESTJ-A")
    expect(result).toContain("interaction and external engagement")
    expect(result).toContain("emotionally steady")
  })

  it("contains sensing description for S types", () => {
    const result = mbtiFlavorText("ISTJ")
    expect(result).toContain("concrete details")
  })

  it("contains thinking description for T types", () => {
    const result = mbtiFlavorText("INTJ")
    expect(result).toContain("logic and consistency")
  })

  it("contains judging description for J types", () => {
    const result = mbtiFlavorText("INFJ")
    expect(result).toContain("structure, planning")
  })

  it("starts with archetype prefix", () => {
    const result = mbtiFlavorText("ENFP")
    expect(result).toMatch(/^Your personality archetype is ENFP\./)
  })

  it("returns null for invalid input", () => {
    expect(mbtiFlavorText("INVALID")).toBeNull()
    expect(mbtiFlavorText("")).toBeNull()
  })
})

describe("getMbtiType", () => {
  it("returns MBTI type from env", () => {
    mockEnv.mockReturnValue({ ANIMA_PERSONALITY_TYPE: "INFP-T" })
    expect(getMbtiType()).toBe("INFP-T")
  })

  it("throws when env() throws (required field)", () => {
    mockEnv.mockImplementation(() => {
      throw new Error("Missing or invalid env var: ANIMA_PERSONALITY_TYPE")
    })
    expect(() => getMbtiType()).toThrow()
  })
})

describe("getEmotionBaseline", () => {
  it("returns MBTI-derived baseline", () => {
    mockEnv.mockReturnValue({ ANIMA_PERSONALITY_TYPE: "INFP-T" })
    const result = getEmotionBaseline()
    expect(result).not.toEqual(DEFAULT_EMOTIONAL_STATE)
    expect(result.curiosity).toBeGreaterThan(DEFAULT_EMOTIONAL_STATE.curiosity)
  })
})
