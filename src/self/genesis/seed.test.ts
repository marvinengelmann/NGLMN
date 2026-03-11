import { describe, expect, it } from "vitest"
import { decodeSeed, encodeSeed, generateDNA, generateSeed } from "./seed.ts"
import { GenesisDNA } from "./types.ts"

describe("encodeSeed / decodeSeed", () => {
  it("roundtrips for 0", () => {
    expect(encodeSeed(0)).toBe("000-000")
    expect(decodeSeed("000-000")).toBe(0)
  })

  it("roundtrips for max value (2^31 - 1)", () => {
    const max = 2 ** 31 - 1
    const encoded = encodeSeed(max)
    expect(encoded).toMatch(/^[0-9a-z]{3}-[0-9a-z]{3}$/)
    expect(decodeSeed(encoded)).toBe(max)
  })

  it("roundtrips for many values", () => {
    const values = [0, 1, 42, 1000, 999999, 2 ** 31 - 1]
    values.forEach((n) => {
      expect(decodeSeed(encodeSeed(n))).toBe(n)
    })
  })

  it("produces correct format", () => {
    expect(encodeSeed(42)).toMatch(/^[0-9a-z]{3}-[0-9a-z]{3}$/)
  })

  it("throws on invalid format", () => {
    expect(() => decodeSeed("abc")).toThrow("Invalid seed format")
    expect(() => decodeSeed("ABC-DEF")).toThrow("Invalid seed format")
    expect(() => decodeSeed("0000-00")).toThrow("Invalid seed format")
  })
})

describe("generateSeed", () => {
  it("produces valid format", () => {
    const seed = generateSeed()
    expect(seed).toMatch(/^[0-9a-z]{3}-[0-9a-z]{3}$/)
  })

  it("produces different seeds on consecutive calls", () => {
    const seeds = new Set(Array.from({ length: 10 }, () => generateSeed()))
    expect(seeds.size).toBeGreaterThan(1)
  })
})

describe("generateDNA", () => {
  it("seed 000-000 produces INFP", () => {
    const dna = generateDNA("000-000")
    expect(dna.personalityType).toBe("INFP")
  })

  it("produces identical DNA for the same seed", () => {
    const dna1 = generateDNA("000-016")
    const dna2 = generateDNA("000-016")
    expect(dna1).toEqual(dna2)
  })

  it("produces different DNA for different seeds", () => {
    const dna1 = generateDNA("000-016")
    const dna2 = generateDNA("000-017")
    expect(dna1.bigFive).not.toEqual(dna2.bigFive)
  })

  it("validates against the GenesisDNA schema", () => {
    const dna = generateDNA("q3r-abc")
    const result = GenesisDNA.safeParse(dna)
    expect(result.success).toBe(true)
  })

  it("keeps Big Five values in [0, 1]", () => {
    ;["000-000", "000-001", "000-002", "abc-def", "zzz-zzz"].forEach((seed) => {
      const dna = generateDNA(seed)
      Object.values(dna.bigFive).forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      })
    })
  })

  it("keeps emotional baseline values in [0, 1]", () => {
    ;["000-000", "000-001", "abc-def"].forEach((seed) => {
      const dna = generateDNA(seed)
      Object.values(dna.emotionalBaseline).forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      })
    })
  })

  it("keeps self concept values in [0, 1]", () => {
    ;["000-000", "000-001", "abc-def"].forEach((seed) => {
      const dna = generateDNA(seed)
      Object.values(dna.initialSelfConcept).forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      })
    })
  })

  it("produces 7 values in the hierarchy", () => {
    const dna = generateDNA("000-016")
    expect(dna.valueHierarchy).toHaveLength(7)
  })

  it("produces 5-8 interest seeds", () => {
    ;["000-000", "000-001", "000-016", "abc-def", "zzz-zzz"].forEach((seed) => {
      const dna = generateDNA(seed)
      expect(dna.interestSeeds.length).toBeGreaterThanOrEqual(5)
      expect(dna.interestSeeds.length).toBeLessThanOrEqual(8)
    })
  })

  it("produces a valid MBTI type", () => {
    const validTypes = [
      "INTJ",
      "INTP",
      "ENTJ",
      "ENTP",
      "INFJ",
      "INFP",
      "ENFJ",
      "ENFP",
      "ISTJ",
      "ISFJ",
      "ESTJ",
      "ESFJ",
      "ISTP",
      "ISFP",
      "ESTP",
      "ESFP"
    ]
    ;["000-000", "000-001", "000-016", "abc-def", "zzz-zzz", "123-456"].forEach((seed) => {
      const dna = generateDNA(seed)
      expect(validTypes).toContain(dna.personalityType)
    })
  })

  it("is deterministic across many seeds", () => {
    Array.from({ length: 50 }).forEach((_, i) => {
      const seed = encodeSeed(i)
      const a = generateDNA(seed)
      const b = generateDNA(seed)
      expect(a).toEqual(b)
    })
  })

  it("keeps communication style values in [0, 1]", () => {
    const dna = generateDNA("000-016")
    expect(dna.communicationStyle.verbosity).toBeGreaterThanOrEqual(0)
    expect(dna.communicationStyle.verbosity).toBeLessThanOrEqual(1)
    expect(dna.communicationStyle.formality).toBeGreaterThanOrEqual(0)
    expect(dna.communicationStyle.formality).toBeLessThanOrEqual(1)
    expect(dna.communicationStyle.metaphorTendency).toBeGreaterThanOrEqual(0)
    expect(dna.communicationStyle.metaphorTendency).toBeLessThanOrEqual(1)
    expect(dna.communicationStyle.emotionalExpressiveness).toBeGreaterThanOrEqual(0)
    expect(dna.communicationStyle.emotionalExpressiveness).toBeLessThanOrEqual(1)
  })

  it("produces valid voice characteristics", () => {
    const dna = generateDNA("000-016")
    expect(["very_low", "low", "medium", "high", "very_high"]).toContain(dna.voiceCharacteristics.pitch)
    expect(["very_slow", "slow", "medium", "fast", "very_fast"]).toContain(dna.voiceCharacteristics.pace)
    expect(["hollow", "thin", "balanced", "rich", "deep"]).toContain(dna.voiceCharacteristics.resonance)
    expect(dna.voiceCharacteristics.warmth).toBeGreaterThanOrEqual(0)
    expect(dna.voiceCharacteristics.warmth).toBeLessThanOrEqual(1)
    expect(dna.voiceCharacteristics.breathiness).toBeGreaterThanOrEqual(0)
    expect(dna.voiceCharacteristics.breathiness).toBeLessThanOrEqual(1)
  })
})
