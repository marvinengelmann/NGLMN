import { describe, expect, it } from "vitest"
import { compute, computeEffect, defaultState } from "./pride.ts"

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
    taskAccomplished: false,
    growthRecognized: false,
    valuesUpheld: false,
    difficultyOvercome: false,
    autonomyExercised: false,
    positiveFeedback: false,
    shameActive: false,
    ...overrides
  }
}

describe("compute", () => {
  it("returns inactive when no triggers", () => {
    const result = compute(makeContext())
    expect(result.isActive).toBe(false)
    expect(result.level).toBe(0)
  })

  it("triggers on task accomplished", () => {
    const result = compute(
      makeContext({
        taskAccomplished: true,
        emotion: { ...baseEmotion, satisfaction: 0.7 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("task_accomplished")
  })

  it("triggers on growth recognized", () => {
    const result = compute(makeContext({ growthRecognized: true }))
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("growth_recognized")
  })

  it("triggers on values upheld", () => {
    const result = compute(
      makeContext({
        valuesUpheld: true,
        emotion: { ...baseEmotion, confidence: 0.7 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("values_upheld")
  })

  it("triggers on difficulty overcome", () => {
    const result = compute(
      makeContext({
        difficultyOvercome: true,
        emotion: { ...baseEmotion, energy: 0.6 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("difficulty_overcome")
  })

  it("triggers on autonomy exercised", () => {
    const result = compute(makeContext({ autonomyExercised: true }))
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("autonomy_exercised")
  })

  it("triggers on positive feedback", () => {
    const result = compute(
      makeContext({
        positiveFeedback: true,
        emotion: { ...baseEmotion, connection: 0.7 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("positive_feedback")
  })

  it("dampens with active shame", () => {
    const withShame = compute(makeContext({ growthRecognized: true, shameActive: true }))
    const without = compute(makeContext({ growthRecognized: true }))
    expect(withShame.level).toBeLessThan(without.level)
  })

  it("tracks glow duration", () => {
    const result = compute(
      makeContext({
        growthRecognized: true,
        previousState: { ...defaultState, glowDuration: 3, level: 0.4, isActive: true }
      })
    )
    expect(result.glowDuration).toBe(4)
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

  it("boosts confidence and energy", () => {
    const state = { ...defaultState, level: 0.5, isActive: true }
    const result = computeEffect(state)
    expect(result.confidence).toBeGreaterThan(0)
    expect(result.energy).toBeGreaterThan(0)
  })

  it("reduces frustration", () => {
    const state = { ...defaultState, level: 0.5, isActive: true }
    const result = computeEffect(state)
    expect(result.frustration).toBeLessThan(0)
  })
})
