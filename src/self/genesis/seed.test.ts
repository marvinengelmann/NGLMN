import { describe, expect, it } from "vitest"
import { generateDNA, generateSeed, isValidSeed, seedToNumeric } from "./seed.ts"
import { GenesisDNA } from "./types.ts"

describe("isValidSeed", () => {
  it("accepts valid 3-word BIP39 seeds", () => {
    expect(isValidSeed("abandon-ability-able")).toBe(true)
    expect(isValidSeed("zoo-zebra-zero")).toBe(true)
    expect(isValidSeed("crystal-dawn-flame")).toBe(true)
  })

  it("rejects seeds with wrong word count", () => {
    expect(isValidSeed("abandon-ability")).toBe(false)
    expect(isValidSeed("abandon")).toBe(false)
    expect(isValidSeed("abandon-ability-able-about")).toBe(false)
  })

  it("rejects seeds with invalid BIP39 words", () => {
    expect(isValidSeed("hello-world-foo")).toBe(false)
    expect(isValidSeed("abandon-ability-notaword")).toBe(false)
  })

  it("rejects empty and malformed strings", () => {
    expect(isValidSeed("")).toBe(false)
    expect(isValidSeed("--")).toBe(false)
    expect(isValidSeed("abc-def-ghi")).toBe(false)
  })

  it("rejects uppercase words", () => {
    expect(isValidSeed("Abandon-Ability-Able")).toBe(false)
  })
})

describe("generateSeed", () => {
  it("produces valid mnemonic seeds", () => {
    for (let i = 0; i < 20; i++) {
      expect(isValidSeed(generateSeed())).toBe(true)
    }
  })

  it("produces different seeds on consecutive calls", () => {
    const seeds = new Set(Array.from({ length: 20 }, () => generateSeed()))
    expect(seeds.size).toBeGreaterThan(1)
  })

  it("produces seeds in word-word-word format", () => {
    const seed = generateSeed()
    const parts = seed.split("-")
    expect(parts).toHaveLength(3)
    expect(parts.every((p) => p.length > 0)).toBe(true)
  })
})

describe("seedToNumeric", () => {
  it("returns the same number for the same seed", () => {
    expect(seedToNumeric("abandon-ability-able")).toBe(seedToNumeric("abandon-ability-able"))
  })

  it("returns different numbers for different seeds", () => {
    expect(seedToNumeric("abandon-ability-able")).not.toBe(seedToNumeric("zoo-zebra-zero"))
  })
})

describe("generateDNA", () => {
  it("produces identical DNA for the same seed", () => {
    const dna1 = generateDNA("crystal-dawn-flame")
    const dna2 = generateDNA("crystal-dawn-flame")
    expect(dna1).toEqual(dna2)
  })

  it("produces different DNA for different seeds", () => {
    const dna1 = generateDNA("crystal-dawn-flame")
    const dna2 = generateDNA("abandon-ability-able")
    expect(dna1.bigFive).not.toEqual(dna2.bigFive)
  })

  it("validates against the GenesisDNA schema", () => {
    const dna = generateDNA("crystal-dawn-flame")
    const result = GenesisDNA.safeParse(dna)
    expect(result.success).toBe(true)
  })

  it("keeps Big Five values in [0, 1]", () => {
    const seeds = ["abandon-ability-able", "zoo-zebra-zero", "crystal-dawn-flame", "frozen-tide-raven"]
    seeds.forEach((seed) => {
      const dna = generateDNA(seed)
      Object.values(dna.bigFive).forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      })
    })
  })

  it("keeps emotional baseline values in [0, 1]", () => {
    const seeds = ["abandon-ability-able", "zoo-zebra-zero", "crystal-dawn-flame"]
    seeds.forEach((seed) => {
      const dna = generateDNA(seed)
      Object.values(dna.emotionalBaseline).forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      })
    })
  })

  it("keeps self concept values in [0, 1]", () => {
    const seeds = ["abandon-ability-able", "zoo-zebra-zero", "crystal-dawn-flame"]
    seeds.forEach((seed) => {
      const dna = generateDNA(seed)
      Object.values(dna.initialSelfConcept).forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      })
    })
  })

  it("produces a valid MBTI type", () => {
    const validTypes = [
      "INTJ", "INTP", "ENTJ", "ENTP",
      "INFJ", "INFP", "ENFJ", "ENFP",
      "ISTJ", "ISFJ", "ESTJ", "ESFJ",
      "ISTP", "ISFP", "ESTP", "ESFP"
    ]
    const seeds = ["abandon-ability-able", "zoo-zebra-zero", "crystal-dawn-flame", "frozen-tide-raven", "alpha-brisk-coral"]
    seeds.forEach((seed) => {
      const dna = generateDNA(seed)
      expect(validTypes).toContain(dna.personalityType)
    })
  })

  it("is deterministic across many seeds", () => {
    const baseSeed = "abandon-ability-able"
    const a = generateDNA(baseSeed)
    const b = generateDNA(baseSeed)
    expect(a).toEqual(b)

    const otherSeeds = ["zoo-zebra-zero", "crystal-dawn-flame", "frozen-tide-raven"]
    otherSeeds.forEach((seed) => {
      expect(generateDNA(seed)).toEqual(generateDNA(seed))
    })
  })

  it("keeps communication style values in [0, 1]", () => {
    const dna = generateDNA("crystal-dawn-flame")
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
    const dna = generateDNA("crystal-dawn-flame")
    expect(["very_low", "low", "medium", "high", "very_high"]).toContain(dna.voiceCharacteristics.pitch)
    expect(["very_slow", "slow", "medium", "fast", "very_fast"]).toContain(dna.voiceCharacteristics.pace)
    expect(["hollow", "thin", "balanced", "rich", "deep"]).toContain(dna.voiceCharacteristics.resonance)
    expect(dna.voiceCharacteristics.warmth).toBeGreaterThanOrEqual(0)
    expect(dna.voiceCharacteristics.warmth).toBeLessThanOrEqual(1)
    expect(dna.voiceCharacteristics.breathiness).toBeGreaterThanOrEqual(0)
    expect(dna.voiceCharacteristics.breathiness).toBeLessThanOrEqual(1)
  })
})
