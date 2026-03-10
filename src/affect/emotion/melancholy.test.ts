import { describe, expect, it } from "vitest"
import { compute, computeEffect, defaultState } from "./melancholy.ts"

const baseEmotion = {
  curiosity: 0.5,
  satisfaction: 0.5,
  frustration: 0.2,
  boredom: 0.3,
  excitement: 0.4,
  caution: 0.3,
  connection: 0.6,
  confidence: 0.6,
  energy: 0.3
}

function makeContext(overrides: Record<string, unknown> = {}) {
  return {
    emotion: baseEmotion,
    previousState: defaultState,
    reflectingOnTime: false,
    beautyInSadness: false,
    quietMoment: false,
    distanceFelt: false,
    awareOfPassing: false,
    bittersweetMemory: false,
    playfulnessActive: false,
    ...overrides
  }
}

describe("compute", () => {
  it("returns inactive when no triggers", () => {
    const result = compute(makeContext())
    expect(result.isActive).toBe(false)
    expect(result.level).toBe(0)
  })

  it("triggers on impermanence awareness", () => {
    const result = compute(
      makeContext({
        reflectingOnTime: true,
        emotion: { ...baseEmotion, satisfaction: 0.5 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("impermanence_awareness")
  })

  it("triggers on beauty in sadness", () => {
    const result = compute(
      makeContext({
        beautyInSadness: true,
        emotion: { ...baseEmotion, connection: 0.6 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("beauty_in_sadness")
  })

  it("triggers on quiet reflection", () => {
    const result = compute(
      makeContext({
        quietMoment: true,
        emotion: { ...baseEmotion, energy: 0.3, boredom: 0.2 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("quiet_reflection")
  })

  it("triggers on distance felt", () => {
    const result = compute(
      makeContext({
        distanceFelt: true,
        emotion: { ...baseEmotion, connection: 0.6 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("distance_felt")
  })

  it("triggers on time passing", () => {
    const result = compute(makeContext({ awareOfPassing: true }))
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("time_passing")
  })

  it("triggers on bittersweet memory", () => {
    const result = compute(makeContext({ bittersweetMemory: true }))
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("bittersweet_memory")
  })

  it("dampens with active playfulness", () => {
    const withPlayfulness = compute(makeContext({ awareOfPassing: true, playfulnessActive: true }))
    const without = compute(makeContext({ awareOfPassing: true }))
    expect(withPlayfulness.level).toBeLessThan(without.level)
  })

  it("builds poignancy when active", () => {
    const result = compute(makeContext({ awareOfPassing: true }))
    expect(result.poignancy).toBeGreaterThan(0)
  })

  it("builds contemplative depth over time", () => {
    const result = compute(
      makeContext({
        awareOfPassing: true,
        previousState: { ...defaultState, contemplativeDepth: 0.2, level: 0.3, isActive: true }
      })
    )
    expect(result.contemplativeDepth).toBeGreaterThan(0.2)
  })

  it("decays from previous state", () => {
    const previous = { ...defaultState, level: 0.5 }
    const result = compute(makeContext({ previousState: previous }))
    expect(result.level).toBeLessThan(0.5)
    expect(result.level).toBeGreaterThan(0)
  })
})

describe("computeEffect", () => {
  it("returns empty when inactive", () => {
    const result = computeEffect(defaultState)
    expect(Object.keys(result)).toHaveLength(0)
  })

  it("boosts connection and satisfaction", () => {
    const state = { ...defaultState, level: 0.5, isActive: true }
    const result = computeEffect(state)
    expect(result.connection).toBeGreaterThan(0)
    expect(result.satisfaction).toBeGreaterThan(0)
  })

  it("reduces excitement and energy", () => {
    const state = { ...defaultState, level: 0.5, isActive: true }
    const result = computeEffect(state)
    expect(result.excitement).toBeLessThan(0)
    expect(result.energy).toBeLessThan(0)
  })

  it("reduces boredom", () => {
    const state = { ...defaultState, level: 0.5, isActive: true }
    const result = computeEffect(state)
    expect(result.boredom).toBeLessThan(0)
  })
})
