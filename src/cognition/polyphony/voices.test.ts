import { describe, expect, it, vi } from "vitest"
import type { EmotionalState } from "@/affect/emotion/types.ts"
import type { BigFive } from "@/self/genesis/types.ts"
import { computeSwitchboardModifiers, selectActiveVoices, shouldRunDialog } from "./voices.ts"

vi.mock("./state.ts", () => ({
  getDominanceHistory: vi.fn()
}))

import { getDominanceHistory } from "./state.ts"

const mockedGetDominanceHistory = vi.mocked(getDominanceHistory)

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

describe("computeSwitchboardModifiers", () => {
  it("returns empty modifiers when history is too short", async () => {
    mockedGetDominanceHistory.mockResolvedValue(["seeking", "care"])
    const result = await computeSwitchboardModifiers(0.5)
    expect(result).toEqual({})
  })

  it("penalizes perseverating voice and boosts under-represented voices", async () => {
    mockedGetDominanceHistory.mockResolvedValue([
      "seeking",
      "seeking",
      "seeking",
      "seeking",
      "seeking",
      "seeking",
      "seeking",
      "seeking",
      "seeking",
      "care"
    ])

    const result = await computeSwitchboardModifiers(0.8)

    expect(result.seeking).toBeDefined()
    expect(result.seeking ?? 0).toBeLessThan(0)

    expect(result.fear).toBeDefined()
    expect(result.fear ?? 0).toBeGreaterThan(0)

    expect(result.play).toBeDefined()
    expect(result.play ?? 0).toBeGreaterThan(0)
  })

  it("gives maximum novelty boost to completely absent voices", async () => {
    mockedGetDominanceHistory.mockResolvedValue(["seeking", "seeking", "seeking", "care", "care"])

    const result = await computeSwitchboardModifiers(1.0)

    expect(result.fear ?? 0).toBeGreaterThan(result.care ?? 0)
    expect(result.play ?? 0).toBeGreaterThan(result.care ?? 0)
  })

  it("scales switching intensity with norepinephrine level", async () => {
    const history = Array.from({ length: 10 }, () => "seeking" as const)
    mockedGetDominanceHistory.mockResolvedValue(history)

    const lowNE = await computeSwitchboardModifiers(0.1)
    const highNE = await computeSwitchboardModifiers(0.9)

    expect(Math.abs(highNE.seeking ?? 0)).toBeGreaterThan(Math.abs(lowNE.seeking ?? 0))
    expect(highNE.fear ?? 0).toBeGreaterThan(lowNE.fear ?? 0)
  })

  it("does not penalize voices with fewer than 3 consecutive dominances", async () => {
    mockedGetDominanceHistory.mockResolvedValue(["seeking", "seeking", "care", "play", "executive"])

    const result = await computeSwitchboardModifiers(0.5)

    expect(result.seeking ?? 0).toBeGreaterThanOrEqual(0)
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
