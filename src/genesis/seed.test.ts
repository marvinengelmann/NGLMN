import { describe, expect, it } from "vitest"
import { GenesisDNA } from "./types.ts"
import { generateDNA } from "./seed.ts"

describe("generateDNA", () => {
  it("produces identical DNA for the same seed", () => {
    const dna1 = generateDNA(42)
    const dna2 = generateDNA(42)
    expect(dna1).toEqual(dna2)
  })

  it("produces different DNA for different seeds", () => {
    const dna1 = generateDNA(42)
    const dna2 = generateDNA(43)
    expect(dna1.bigFive).not.toEqual(dna2.bigFive)
    expect(dna1.personalityType === dna2.personalityType && dna1.bigFive.openness === dna2.bigFive.openness).toBe(false)
  })

  it("validates against the GenesisDNA schema", () => {
    const dna = generateDNA(1847295036)
    const result = GenesisDNA.safeParse(dna)
    expect(result.success).toBe(true)
  })

  it("keeps Big Five values in [0, 1]", () => {
    for (const seed of [0, 1, 100, 999999, 2147483647]) {
      const dna = generateDNA(seed)
      for (const val of Object.values(dna.bigFive)) {
        expect(val).toBeGreaterThanOrEqual(0)
        expect(val).toBeLessThanOrEqual(1)
      }
    }
  })

  it("keeps emotional baseline values in [0, 1]", () => {
    for (const seed of [0, 1, 100, 999999]) {
      const dna = generateDNA(seed)
      for (const val of Object.values(dna.emotionalBaseline)) {
        expect(val).toBeGreaterThanOrEqual(0)
        expect(val).toBeLessThanOrEqual(1)
      }
    }
  })

  it("keeps self concept values in [0, 1]", () => {
    for (const seed of [0, 1, 100, 999999]) {
      const dna = generateDNA(seed)
      for (const val of Object.values(dna.initialSelfConcept)) {
        expect(val).toBeGreaterThanOrEqual(0)
        expect(val).toBeLessThanOrEqual(1)
      }
    }
  })

  it("produces 7 values in the hierarchy", () => {
    const dna = generateDNA(42)
    expect(dna.valueHierarchy).toHaveLength(7)
  })

  it("produces 5-8 interest seeds", () => {
    for (const seed of [0, 1, 42, 100, 999]) {
      const dna = generateDNA(seed)
      expect(dna.interestSeeds.length).toBeGreaterThanOrEqual(5)
      expect(dna.interestSeeds.length).toBeLessThanOrEqual(8)
    }
  })

  it("produces a valid MBTI type", () => {
    const validTypes = [
      "INTJ", "INTP", "ENTJ", "ENTP", "INFJ", "INFP", "ENFJ", "ENFP",
      "ISTJ", "ISFJ", "ESTJ", "ESFJ", "ISTP", "ISFP", "ESTP", "ESFP"
    ]
    for (const seed of [0, 1, 42, 100, 999, 123456]) {
      const dna = generateDNA(seed)
      expect(validTypes).toContain(dna.personalityType)
    }
  })

  it("is deterministic across many seeds", () => {
    for (let seed = 0; seed < 50; seed++) {
      const a = generateDNA(seed)
      const b = generateDNA(seed)
      expect(a).toEqual(b)
    }
  })

  it("keeps communication style values in [0, 1]", () => {
    const dna = generateDNA(42)
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
    const dna = generateDNA(42)
    expect(["very_low", "low", "medium", "high", "very_high"]).toContain(dna.voiceCharacteristics.pitch)
    expect(["very_slow", "slow", "medium", "fast", "very_fast"]).toContain(dna.voiceCharacteristics.pace)
    expect(["hollow", "thin", "balanced", "rich", "deep"]).toContain(dna.voiceCharacteristics.resonance)
    expect(dna.voiceCharacteristics.warmth).toBeGreaterThanOrEqual(0)
    expect(dna.voiceCharacteristics.warmth).toBeLessThanOrEqual(1)
    expect(dna.voiceCharacteristics.breathiness).toBeGreaterThanOrEqual(0)
    expect(dna.voiceCharacteristics.breathiness).toBeLessThanOrEqual(1)
  })
})
