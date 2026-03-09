import { describe, expect, it } from "vitest"
import { computePride, computePrideEffect, DEFAULT_PRIDE_STATE } from "./pride.ts"

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
    previousState: DEFAULT_PRIDE_STATE,
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

describe("computePride", () => {
  it("returns inactive when no triggers", () => {
    const result = computePride(makeContext())
    expect(result.isActive).toBe(false)
    expect(result.level).toBe(0)
  })

  it("triggers on task accomplished", () => {
    const result = computePride(
      makeContext({
        taskAccomplished: true,
        emotion: { ...baseEmotion, satisfaction: 0.7 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("task_accomplished")
  })

  it("triggers on growth recognized", () => {
    const result = computePride(makeContext({ growthRecognized: true }))
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("growth_recognized")
  })

  it("triggers on values upheld", () => {
    const result = computePride(
      makeContext({
        valuesUpheld: true,
        emotion: { ...baseEmotion, confidence: 0.7 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("values_upheld")
  })

  it("triggers on difficulty overcome", () => {
    const result = computePride(
      makeContext({
        difficultyOvercome: true,
        emotion: { ...baseEmotion, energy: 0.6 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("difficulty_overcome")
  })

  it("triggers on autonomy exercised", () => {
    const result = computePride(makeContext({ autonomyExercised: true }))
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("autonomy_exercised")
  })

  it("triggers on positive feedback", () => {
    const result = computePride(
      makeContext({
        positiveFeedback: true,
        emotion: { ...baseEmotion, connection: 0.7 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("positive_feedback")
  })

  it("dampens with active shame", () => {
    const withShame = computePride(makeContext({ growthRecognized: true, shameActive: true }))
    const without = computePride(makeContext({ growthRecognized: true }))
    expect(withShame.level).toBeLessThan(without.level)
  })

  it("tracks glow duration", () => {
    const result = computePride(
      makeContext({
        growthRecognized: true,
        previousState: { ...DEFAULT_PRIDE_STATE, glowDuration: 3, level: 0.4, isActive: true }
      })
    )
    expect(result.glowDuration).toBe(4)
  })

  it("decays from previous state", () => {
    const previous = { ...DEFAULT_PRIDE_STATE, level: 0.5 }
    const result = computePride(makeContext({ previousState: previous }))
    expect(result.level).toBeLessThan(0.5)
    expect(result.level).toBeGreaterThan(0)
  })
})

describe("computePrideEffect", () => {
  it("returns empty when inactive", () => {
    const result = computePrideEffect(DEFAULT_PRIDE_STATE)
    expect(Object.keys(result)).toHaveLength(0)
  })

  it("boosts confidence and energy", () => {
    const state = { ...DEFAULT_PRIDE_STATE, level: 0.5, isActive: true }
    const result = computePrideEffect(state)
    expect(result.confidence).toBeGreaterThan(0)
    expect(result.energy).toBeGreaterThan(0)
  })

  it("reduces frustration", () => {
    const state = { ...DEFAULT_PRIDE_STATE, level: 0.5, isActive: true }
    const result = computePrideEffect(state)
    expect(result.frustration).toBeLessThan(0)
  })
})
