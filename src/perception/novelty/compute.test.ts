import { describe, expect, it } from "vitest"
import { makeEmotionalState } from "@/test/factories.ts"
import { computeNoveltyEffect, computeNoveltyLevel, computeSurprise, updateNoveltyState } from "./compute.ts"
import { DEFAULT_NOVELTY_STATE, DEFAULT_SURPRISE_STATE, type SurpriseState } from "./types.ts"

describe("computeNoveltyLevel", () => {
  it("should return high novelty for unseen stimulus", () => {
    const { level } = computeNoveltyLevel("completely new topic", {})
    expect(level).toBe(1)
  })

  it("should return lower novelty for repeated stimulus", () => {
    const { level } = computeNoveltyLevel("repeated topic", { "repeated topic": 3 })
    expect(level).toBeLessThan(1)
  })

  it("should habituate to zero after enough exposure", () => {
    const { level } = computeNoveltyLevel("old topic", { "old topic": 10 })
    expect(level).toBe(0)
  })
})

describe("computeSurprise", () => {
  it("should compute surprise from violations", () => {
    const violations = [
      {
        expectation: { content: "test", source: "pattern" as const, confidence: 0.8, expectedAt: null, valence: 0.5 },
        actualOutcome: "unexpected event",
        surpriseIntensity: 0.7,
        valence: -0.3
      }
    ]

    const result = computeSurprise(violations, 0.5, DEFAULT_SURPRISE_STATE)
    expect(result.level).toBeGreaterThan(0)
    expect(result.isActive).toBe(true)
  })

  it("should decay when no violations and low novelty", () => {
    const previous: SurpriseState = { level: 0.5, isActive: true, valence: 0.3, source: "test" }
    const result = computeSurprise([], 0.1, previous)
    expect(result.level).toBeLessThan(0.5)
    expect(result.isActive).toBe(false)
  })
})

describe("computeNoveltyEffect", () => {
  it("should boost curiosity for high novelty", () => {
    const effect = computeNoveltyEffect(0.7, DEFAULT_SURPRISE_STATE)
    expect(effect.curiosity).toBeGreaterThan(0)
    expect(effect.boredom).toBeLessThan(0)
  })

  it("should return empty for low novelty", () => {
    const effect = computeNoveltyEffect(0.1, DEFAULT_SURPRISE_STATE)
    expect(Object.keys(effect).length).toBe(0)
  })
})

describe("updateNoveltyState", () => {
  it("should detect novelty in new messages", () => {
    const result = updateNoveltyState(DEFAULT_NOVELTY_STATE, ["something completely new"], makeEmotionalState())
    expect(result.level).toBeGreaterThan(0)
    expect(result.isActive).toBe(true)
  })

  it("should increase novelty seeking urge when bored with no messages", () => {
    const result = updateNoveltyState(DEFAULT_NOVELTY_STATE, [], makeEmotionalState({ boredom: 0.8 }))
    expect(result.noveltySeekingUrge).toBeGreaterThan(DEFAULT_NOVELTY_STATE.noveltySeekingUrge)
  })
})
