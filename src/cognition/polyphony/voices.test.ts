import { describe, expect, it } from "vitest"
import type { EmotionalState } from "@/affect/emotion/types.ts"
import type { BigFive } from "@/self/genesis/types.ts"
import { selectActiveVoices, shouldRunDialog } from "./voices.ts"

const baseEmotion: EmotionalState = {
  curiosity: 0.5,
  satisfaction: 0.5,
  frustration: 0.5,
  boredom: 0.5,
  excitement: 0.5,
  caution: 0.5,
  connection: 0.5,
  confidence: 0.5,
  energy: 0.5
}

const baseContext = { dissonanceScore: 0, action: "idle", hasMessages: false }

const balancedBigFive: BigFive = {
  openness: 0.5,
  conscientiousness: 0.5,
  extraversion: 0.5,
  agreeableness: 0.5,
  neuroticism: 0.5
}

const highOpenness: BigFive = { ...balancedBigFive, openness: 0.9 }
const highConscientiousness: BigFive = { ...balancedBigFive, conscientiousness: 0.9 }
const highNeuroticism: BigFive = { ...balancedBigFive, neuroticism: 0.9 }
const highAgreeableness: BigFive = { ...balancedBigFive, agreeableness: 0.9, extraversion: 0.8 }

describe("selectActiveVoices", () => {
  it("always returns 2-4 voices", () => {
    const voices = selectActiveVoices(baseEmotion, balancedBigFive, baseContext)
    expect(voices.length).toBeGreaterThanOrEqual(2)
    expect(voices.length).toBeLessThanOrEqual(4)
  })

  it("includes monitoring when dissonance is high", () => {
    const voices = selectActiveVoices(baseEmotion, balancedBigFive, { ...baseContext, dissonanceScore: 0.6 })
    expect(voices).toContain("monitoring")
  })

  it("includes fear when caution is high", () => {
    const voices = selectActiveVoices({ ...baseEmotion, caution: 0.8 }, balancedBigFive, baseContext)
    expect(voices).toContain("fear")
  })

  it("includes seeking when curiosity is high", () => {
    const voices = selectActiveVoices({ ...baseEmotion, curiosity: 0.8 }, balancedBigFive, baseContext)
    expect(voices).toContain("seeking")
  })

  it("boosts seeking for high openness", () => {
    const voices = selectActiveVoices(baseEmotion, highOpenness, baseContext)
    expect(voices).toContain("seeking")
  })

  it("boosts executive for high conscientiousness", () => {
    const voices = selectActiveVoices(baseEmotion, highConscientiousness, baseContext)
    expect(voices).toContain("executive")
  })

  it("boosts fear and monitoring for high neuroticism", () => {
    const voices = selectActiveVoices(baseEmotion, highNeuroticism, baseContext)
    expect(voices).toContain("fear")
    expect(voices).toContain("monitoring")
  })

  it("boosts care for high extraversion and agreeableness", () => {
    const voices = selectActiveVoices(baseEmotion, highAgreeableness, baseContext)
    expect(voices).toContain("care")
  })

  it("provides continuous weighting — higher openness means stronger novelty boost", () => {
    const lowOpenness: BigFive = { ...balancedBigFive, openness: 0.2 }
    const voicesLow = selectActiveVoices(baseEmotion, lowOpenness, baseContext)
    const voicesHigh = selectActiveVoices(baseEmotion, highOpenness, baseContext)
    const hasNoveltyLow = voicesLow.includes("seeking")
    const hasNoveltyHigh = voicesHigh.includes("seeking")
    expect(hasNoveltyHigh || !hasNoveltyLow).toBe(true)
  })
})

describe("shouldRunDialog", () => {
  it("returns true when there are messages", () => {
    expect(shouldRunDialog(baseEmotion, true, 0, "idle")).toBe(true)
  })

  it("returns true when dissonance is high", () => {
    expect(shouldRunDialog(baseEmotion, false, 0.5, "idle")).toBe(true)
  })

  it("returns true when action is not idle", () => {
    expect(shouldRunDialog(baseEmotion, false, 0, "reflect")).toBe(true)
  })

  it("returns true when emotion is extreme", () => {
    expect(shouldRunDialog({ ...baseEmotion, frustration: 0.9 }, false, 0, "idle")).toBe(true)
  })

  it("returns false for idle tick with balanced emotions", () => {
    expect(shouldRunDialog(baseEmotion, false, 0, "idle")).toBe(false)
  })
})
