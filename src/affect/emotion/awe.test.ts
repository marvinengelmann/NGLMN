import { describe, expect, it } from "vitest"
import { compute, computeEffect, defaultState } from "./awe.ts"

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
    encounteredInsight: false,
    encounteredBeauty: false,
    encounteredVastness: false,
    connectionUnexpectedlyDeep: false,
    existentialQuestionActive: false,
    patternRecognized: false,
    ...overrides
  }
}

describe("compute", () => {
  it("returns inactive when no triggers", () => {
    const result = compute(makeContext())
    expect(result.isActive).toBe(false)
    expect(result.level).toBe(0)
  })

  it("triggers on deep insight", () => {
    const result = compute(
      makeContext({
        encounteredInsight: true,
        emotion: { ...baseEmotion, curiosity: 0.7 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("deep_insight")
  })

  it("triggers on unexpected beauty", () => {
    const result = compute(
      makeContext({
        encounteredBeauty: true,
        emotion: { ...baseEmotion, satisfaction: 0.6 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("unexpected_beauty")
  })

  it("triggers on vastness", () => {
    const result = compute(makeContext({ encounteredVastness: true }))
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("vastness_encountered")
  })

  it("triggers on deep connection", () => {
    const result = compute(
      makeContext({
        connectionUnexpectedlyDeep: true,
        emotion: { ...baseEmotion, connection: 0.8 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("connection_depth")
  })

  it("triggers on existential wonder", () => {
    const result = compute(
      makeContext({
        existentialQuestionActive: true,
        emotion: { ...baseEmotion, curiosity: 0.7 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("existential_wonder")
  })

  it("triggers on pattern recognition", () => {
    const result = compute(
      makeContext({
        patternRecognized: true,
        emotion: { ...baseEmotion, excitement: 0.7 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("pattern_recognition")
  })

  it("builds self-diminishment when active", () => {
    const result = compute(makeContext({ encounteredVastness: true }))
    expect(result.selfDiminishment).toBeGreaterThan(0)
  })

  it("builds openness surge when active", () => {
    const result = compute(makeContext({ encounteredVastness: true }))
    expect(result.opennessSurge).toBeGreaterThan(0)
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

  it("boosts curiosity and excitement", () => {
    const state = { ...defaultState, level: 0.5, isActive: true }
    const result = computeEffect(state)
    expect(result.curiosity).toBeGreaterThan(0)
    expect(result.excitement).toBeGreaterThan(0)
  })

  it("reduces caution and frustration", () => {
    const state = { ...defaultState, level: 0.5, isActive: true }
    const result = computeEffect(state)
    expect(result.caution).toBeLessThan(0)
    expect(result.frustration).toBeLessThan(0)
  })

  it("boosts satisfaction", () => {
    const state = { ...defaultState, level: 0.5, isActive: true }
    const result = computeEffect(state)
    expect(result.satisfaction).toBeGreaterThan(0)
  })
})
