import { describe, expect, it } from "vitest"
import { DEFAULT_EMOTIONAL_STATE, type EmotionalState } from "./types.ts"
import { applyCrossCoupling, computeValence } from "./update.ts"

const neutral: EmotionalState = { ...DEFAULT_EMOTIONAL_STATE }

describe("applyCrossCoupling — amplification rules", () => {
  it("amplifies excitement when curiosity > 0.7 and energy > 0.6", () => {
    const state: EmotionalState = { ...neutral, curiosity: 0.8, energy: 0.7, excitement: 0.5 }
    const result = applyCrossCoupling(state)
    expect(result.excitement).toBeGreaterThan(0.5)
  })

  it("does not amplify excitement when curiosity is low", () => {
    const state: EmotionalState = { ...neutral, curiosity: 0.3, energy: 0.7, excitement: 0.5 }
    const result = applyCrossCoupling(state)
    expect(result.excitement).toBeLessThanOrEqual(0.5)
  })

  it("amplifies confidence when satisfaction > 0.7", () => {
    const state: EmotionalState = { ...neutral, satisfaction: 0.8, confidence: 0.5 }
    const result = applyCrossCoupling(state)
    expect(result.confidence).toBeGreaterThan(0.5)
  })

  it("amplifies satisfaction when connection > 0.7 and excitement > 0.6", () => {
    const state: EmotionalState = { ...neutral, connection: 0.8, excitement: 0.7, satisfaction: 0.5 }
    const result = applyCrossCoupling(state)
    expect(result.satisfaction).toBeGreaterThan(0.5)
  })

  it("amplifies curiosity when energy > 0.7", () => {
    const state: EmotionalState = { ...neutral, energy: 0.8, curiosity: 0.5 }
    const result = applyCrossCoupling(state)
    expect(result.curiosity).toBeGreaterThan(0.5)
  })

  it("suppresses confidence when frustration > 0.7", () => {
    const state: EmotionalState = { ...neutral, frustration: 0.8, confidence: 0.6 }
    const result = applyCrossCoupling(state)
    expect(result.confidence).toBeLessThan(0.6)
  })

  it("clamps all values to [0, 1]", () => {
    const state: EmotionalState = {
      ...neutral,
      curiosity: 0.95,
      energy: 0.95,
      excitement: 0.95,
      satisfaction: 0.95,
      connection: 0.95,
      confidence: 0.95
    }
    const result = applyCrossCoupling(state)
    for (const value of Object.values(result)) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })
})

describe("computeValence", () => {
  it("returns 0 for perfectly neutral state", () => {
    const state: EmotionalState = {
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
    expect(computeValence(state)).toBe(0)
  })

  it("returns positive for high positive emotions", () => {
    const state: EmotionalState = {
      ...neutral,
      satisfaction: 0.9,
      connection: 0.9,
      confidence: 0.9,
      excitement: 0.9,
      frustration: 0.1,
      boredom: 0.1,
      caution: 0.1
    }
    expect(computeValence(state)).toBeGreaterThan(0.5)
  })

  it("returns negative for high negative emotions", () => {
    const state: EmotionalState = {
      ...neutral,
      satisfaction: 0.1,
      connection: 0.1,
      confidence: 0.1,
      excitement: 0.1,
      frustration: 0.9,
      boredom: 0.9,
      caution: 0.9
    }
    expect(computeValence(state)).toBeLessThan(-0.5)
  })

  it("is clamped to [-1, 1]", () => {
    const extreme: EmotionalState = {
      curiosity: 1,
      satisfaction: 1,
      frustration: 0,
      boredom: 0,
      excitement: 1,
      caution: 0,
      connection: 1,
      confidence: 1,
      energy: 1
    }
    expect(computeValence(extreme)).toBeLessThanOrEqual(1)
    expect(computeValence(extreme)).toBeGreaterThanOrEqual(-1)
  })
})
