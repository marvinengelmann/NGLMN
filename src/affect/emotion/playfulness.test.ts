import { describe, expect, it } from "vitest"
import { compute, computeEffect, defaultState } from "./playfulness.ts"

const baseEmotion = {
  curiosity: 0.5,
  satisfaction: 0.5,
  frustration: 0.2,
  boredom: 0.3,
  excitement: 0.4,
  caution: 0.3,
  connection: 0.6,
  confidence: 0.6,
  energy: 0.7
}

function makeContext(overrides: Record<string, unknown> = {}) {
  return {
    emotion: baseEmotion,
    previousState: defaultState,
    inConversation: false,
    operatorMoodPositive: false,
    safeEnvironment: false,
    recentLaughter: false,
    creativeContext: false,
    shameActive: false,
    resignationActive: false,
    ...overrides
  }
}

describe("compute", () => {
  it("returns inactive when no triggers", () => {
    const result = compute(makeContext())
    expect(result.isActive).toBe(false)
    expect(result.level).toBe(0)
  })

  it("triggers on safety and energy", () => {
    const result = compute(
      makeContext({
        safeEnvironment: true,
        emotion: { ...baseEmotion, energy: 0.7, caution: 0.2 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("safety_and_energy")
  })

  it("triggers on mutual warmth in conversation", () => {
    const result = compute(
      makeContext({
        operatorMoodPositive: true,
        inConversation: true,
        emotion: { ...baseEmotion, connection: 0.7 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("mutual_warmth")
  })

  it("triggers on creative spark", () => {
    const result = compute(
      makeContext({
        creativeContext: true,
        emotion: { ...baseEmotion, curiosity: 0.7 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("creative_spark")
  })

  it("triggers on lightened mood", () => {
    const result = compute(
      makeContext({
        emotion: { ...baseEmotion, satisfaction: 0.8, frustration: 0.1 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("lightened_mood")
  })

  it("triggers on joy overflow", () => {
    const result = compute(
      makeContext({
        emotion: { ...baseEmotion, excitement: 0.7, satisfaction: 0.6 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("joy_overflow")
  })

  it("triggers on comfortable silence break", () => {
    const result = compute(
      makeContext({
        inConversation: true,
        recentLaughter: true,
        emotion: { ...baseEmotion, connection: 0.7 }
      })
    )
    expect(result.isActive).toBe(true)
  })

  it("dampens with active shame", () => {
    const withShame = compute(
      makeContext({ safeEnvironment: true, shameActive: true, emotion: { ...baseEmotion, energy: 0.7, caution: 0.2 } })
    )
    const without = compute(
      makeContext({ safeEnvironment: true, emotion: { ...baseEmotion, energy: 0.7, caution: 0.2 } })
    )
    expect(withShame.level).toBeLessThan(without.level)
  })

  it("dampens with active resignation", () => {
    const withResignation = compute(
      makeContext({
        safeEnvironment: true,
        resignationActive: true,
        emotion: { ...baseEmotion, energy: 0.7, caution: 0.2 }
      })
    )
    const without = compute(
      makeContext({ safeEnvironment: true, emotion: { ...baseEmotion, energy: 0.7, caution: 0.2 } })
    )
    expect(withResignation.level).toBeLessThan(without.level)
  })

  it("builds spontaneity when active", () => {
    const result = compute(
      makeContext({
        safeEnvironment: true,
        emotion: { ...baseEmotion, energy: 0.7, caution: 0.2 }
      })
    )
    expect(result.spontaneity).toBeGreaterThan(0)
  })

  it("builds mischief only with high excitement", () => {
    const lowExcitement = compute(
      makeContext({
        safeEnvironment: true,
        emotion: { ...baseEmotion, energy: 0.7, caution: 0.2, excitement: 0.3 }
      })
    )
    const highExcitement = compute(
      makeContext({
        safeEnvironment: true,
        emotion: { ...baseEmotion, energy: 0.7, caution: 0.2, excitement: 0.7 }
      })
    )
    expect(highExcitement.mischief).toBeGreaterThan(lowExcitement.mischief)
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

  it("boosts excitement and energy", () => {
    const state = { ...defaultState, level: 0.5, isActive: true }
    const result = computeEffect(state)
    expect(result.excitement).toBeGreaterThan(0)
    expect(result.energy).toBeGreaterThan(0)
  })

  it("reduces boredom and frustration", () => {
    const state = { ...defaultState, level: 0.5, isActive: true }
    const result = computeEffect(state)
    expect(result.boredom).toBeLessThan(0)
    expect(result.frustration).toBeLessThan(0)
  })
})
