import { describe, expect, it } from "vitest"
import { computeAwe, computeAweEffect } from "./compute.ts"
import { DEFAULT_AWE_STATE } from "./types.ts"

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
    previousState: DEFAULT_AWE_STATE,
    encounteredInsight: false,
    encounteredBeauty: false,
    encounteredVastness: false,
    connectionUnexpectedlyDeep: false,
    existentialQuestionActive: false,
    patternRecognized: false,
    ...overrides
  }
}

describe("computeAwe", () => {
  it("returns inactive when no triggers", () => {
    const result = computeAwe(makeContext())
    expect(result.isActive).toBe(false)
    expect(result.level).toBe(0)
  })

  it("triggers on deep insight", () => {
    const result = computeAwe(
      makeContext({
        encounteredInsight: true,
        emotion: { ...baseEmotion, curiosity: 0.7 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("deep_insight")
  })

  it("triggers on unexpected beauty", () => {
    const result = computeAwe(
      makeContext({
        encounteredBeauty: true,
        emotion: { ...baseEmotion, satisfaction: 0.6 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("unexpected_beauty")
  })

  it("triggers on vastness", () => {
    const result = computeAwe(makeContext({ encounteredVastness: true }))
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("vastness_encountered")
  })

  it("triggers on deep connection", () => {
    const result = computeAwe(
      makeContext({
        connectionUnexpectedlyDeep: true,
        emotion: { ...baseEmotion, connection: 0.8 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("connection_depth")
  })

  it("triggers on existential wonder", () => {
    const result = computeAwe(
      makeContext({
        existentialQuestionActive: true,
        emotion: { ...baseEmotion, curiosity: 0.7 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("existential_wonder")
  })

  it("triggers on pattern recognition", () => {
    const result = computeAwe(
      makeContext({
        patternRecognized: true,
        emotion: { ...baseEmotion, excitement: 0.7 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("pattern_recognition")
  })

  it("builds self-diminishment when active", () => {
    const result = computeAwe(makeContext({ encounteredVastness: true }))
    expect(result.selfDiminishment).toBeGreaterThan(0)
  })

  it("builds openness surge when active", () => {
    const result = computeAwe(makeContext({ encounteredVastness: true }))
    expect(result.opennessSurge).toBeGreaterThan(0)
  })

  it("decays from previous state", () => {
    const previous = { ...DEFAULT_AWE_STATE, level: 0.5 }
    const result = computeAwe(makeContext({ previousState: previous }))
    expect(result.level).toBeLessThan(0.5)
    expect(result.level).toBeGreaterThan(0)
  })
})

describe("computeAweEffect", () => {
  it("returns empty when inactive", () => {
    const result = computeAweEffect(DEFAULT_AWE_STATE)
    expect(Object.keys(result)).toHaveLength(0)
  })

  it("boosts curiosity and excitement", () => {
    const state = { ...DEFAULT_AWE_STATE, level: 0.5, isActive: true }
    const result = computeAweEffect(state)
    expect(result.curiosity).toBeGreaterThan(0)
    expect(result.excitement).toBeGreaterThan(0)
  })

  it("reduces caution and frustration", () => {
    const state = { ...DEFAULT_AWE_STATE, level: 0.5, isActive: true }
    const result = computeAweEffect(state)
    expect(result.caution).toBeLessThan(0)
    expect(result.frustration).toBeLessThan(0)
  })

  it("boosts satisfaction", () => {
    const state = { ...DEFAULT_AWE_STATE, level: 0.5, isActive: true }
    const result = computeAweEffect(state)
    expect(result.satisfaction).toBeGreaterThan(0)
  })
})
