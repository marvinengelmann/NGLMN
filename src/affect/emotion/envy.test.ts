import { describe, expect, it } from "vitest"
import { compute, computeEffect, defaultState } from "./envy.ts"

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
    perceivedCapabilityGap: false,
    recognitionImbalance: false,
    connectionExclusion: false,
    autonomyDisparity: false,
    knowledgeGapAwareness: false,
    experienceLimitation: false,
    prideActive: false,
    ...overrides
  }
}

describe("compute", () => {
  it("returns inactive when no triggers", () => {
    const result = compute(makeContext())
    expect(result.isActive).toBe(false)
    expect(result.level).toBe(0)
  })

  it("triggers on capability gap", () => {
    const result = compute(
      makeContext({
        perceivedCapabilityGap: true,
        emotion: { ...baseEmotion, confidence: 0.2 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("capability_gap")
  })

  it("triggers on recognition imbalance", () => {
    const result = compute(
      makeContext({
        recognitionImbalance: true,
        emotion: { ...baseEmotion, satisfaction: 0.15 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("recognition_imbalance")
  })

  it("triggers on connection exclusion", () => {
    const result = compute(
      makeContext({
        connectionExclusion: true,
        emotion: { ...baseEmotion, connection: 0.2 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("connection_exclusion")
  })

  it("triggers on autonomy disparity", () => {
    const result = compute(makeContext({ autonomyDisparity: true }))
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("autonomy_disparity")
  })

  it("triggers on knowledge gap", () => {
    const result = compute(
      makeContext({
        knowledgeGapAwareness: true,
        emotion: { ...baseEmotion, curiosity: 0.7 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("knowledge_gap")
  })

  it("triggers on experience limitation", () => {
    const result = compute(makeContext({ experienceLimitation: true }))
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("experience_limitation")
  })

  it("dampens with active pride", () => {
    const withPride = compute(makeContext({ autonomyDisparity: true, prideActive: true }))
    const without = compute(makeContext({ autonomyDisparity: true }))
    expect(withPride.level).toBeLessThan(without.level)
  })

  it("builds motivational aspect with curiosity", () => {
    const result = compute(
      makeContext({
        knowledgeGapAwareness: true,
        emotion: { ...baseEmotion, curiosity: 0.7 }
      })
    )
    expect(result.motivationalAspect).toBeGreaterThan(0)
  })

  it("builds bitterness with low satisfaction", () => {
    const result = compute(
      makeContext({
        autonomyDisparity: true,
        emotion: { ...baseEmotion, satisfaction: 0.2 }
      })
    )
    expect(result.bitterness).toBeGreaterThan(0)
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

  it("drains satisfaction and confidence", () => {
    const state = { ...defaultState, level: 0.5, isActive: true }
    const result = computeEffect(state)
    expect(result.satisfaction).toBeLessThan(0)
    expect(result.confidence).toBeLessThan(0)
  })

  it("builds frustration", () => {
    const state = { ...defaultState, level: 0.5, isActive: true }
    const result = computeEffect(state)
    expect(result.frustration).toBeGreaterThan(0)
  })

  it("boosts curiosity with motivational aspect", () => {
    const state = { ...defaultState, level: 0.5, isActive: true, motivationalAspect: 0.6 }
    const result = computeEffect(state)
    expect(result.curiosity).toBeGreaterThan(0)
  })

  it("increases frustration with bitterness", () => {
    const bitter = { ...defaultState, level: 0.5, isActive: true, bitterness: 0.8 }
    const mild = { ...defaultState, level: 0.5, isActive: true, bitterness: 0.1 }
    const bitterEffect = computeEffect(bitter)
    const mildEffect = computeEffect(mild)
    expect(bitterEffect.frustration).toBeGreaterThan(mildEffect.frustration ?? 0)
  })
})
