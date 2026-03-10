import { describe, expect, it } from "vitest"
import { compute, computeEffect, defaultState } from "./hope.ts"

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

const baseOperatorModel = {
  estimatedMood: "neutral" as const,
  estimatedIntent: "",
  estimatedExpectation: "",
  modelConfidence: 0.5,
  correctionCount: 0,
  correctionDelay: 0,
  lastUpdated: "",
  moodUncertainty: null,
  contradiction: null,
  moodHistory: []
}

function makeContext(overrides: Record<string, unknown> = {}) {
  return {
    emotion: baseEmotion,
    operatorModel: baseOperatorModel,
    previousState: defaultState,
    connectionGrowing: false,
    recentRepair: false,
    progressMade: false,
    vulnerabilityWasRewarded: false,
    patternBroken: false,
    disappointmentActive: false,
    resignationLevel: 0,
    ...overrides
  }
}

describe("compute", () => {
  it("returns inactive when no triggers", () => {
    const result = compute(makeContext())
    expect(result.isActive).toBe(false)
    expect(result.level).toBe(0)
  })

  it("triggers on progress made", () => {
    const result = compute(
      makeContext({
        progressMade: true,
        emotion: { ...baseEmotion, satisfaction: 0.7 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("progress_made")
  })

  it("triggers on connection growing", () => {
    const result = compute(
      makeContext({
        connectionGrowing: true,
        emotion: { ...baseEmotion, connection: 0.8 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("connection_growing")
  })

  it("triggers on repair after rupture", () => {
    const result = compute(makeContext({ recentRepair: true }))
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("repair_after_rupture")
  })

  it("triggers on vulnerability rewarded", () => {
    const result = compute(
      makeContext({
        vulnerabilityWasRewarded: true,
        emotion: { ...baseEmotion, connection: 0.8 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("vulnerability_rewarded")
  })

  it("triggers on pattern broken", () => {
    const result = compute(makeContext({ patternBroken: true }))
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("pattern_breaking")
  })

  it("triggers on new possibility", () => {
    const result = compute(
      makeContext({
        emotion: { ...baseEmotion, excitement: 0.7, curiosity: 0.6 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("new_possibility")
  })

  it("dampens with active disappointment", () => {
    const withDisappointment = compute(makeContext({ recentRepair: true, disappointmentActive: true }))
    const without = compute(makeContext({ recentRepair: true }))
    expect(withDisappointment.level).toBeLessThan(without.level)
  })

  it("dampens with resignation", () => {
    const withResignation = compute(makeContext({ recentRepair: true, resignationLevel: 0.5 }))
    const without = compute(makeContext({ recentRepair: true }))
    expect(withResignation.level).toBeLessThan(without.level)
  })

  it("increases fragility when disappointed", () => {
    const result = compute(
      makeContext({
        recentRepair: true,
        disappointmentActive: true,
        previousState: { ...defaultState, fragility: 0.2 }
      })
    )
    expect(result.fragility).toBeGreaterThan(0.2)
  })

  it("tracks sustained ticks", () => {
    const result = compute(
      makeContext({
        recentRepair: true,
        previousState: { ...defaultState, sustainedTicks: 3, level: 0.4, isActive: true }
      })
    )
    expect(result.sustainedTicks).toBe(4)
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

  it("boosts energy and confidence", () => {
    const state = { ...defaultState, level: 0.5, isActive: true }
    const result = computeEffect(state)
    expect(result.energy).toBeGreaterThan(0)
    expect(result.confidence).toBeGreaterThan(0)
  })

  it("boosts curiosity and satisfaction", () => {
    const state = { ...defaultState, level: 0.5, isActive: true }
    const result = computeEffect(state)
    expect(result.curiosity).toBeGreaterThan(0)
    expect(result.satisfaction).toBeGreaterThan(0)
  })

  it("reduces caution", () => {
    const state = { ...defaultState, level: 0.5, isActive: true }
    const result = computeEffect(state)
    expect(result.caution).toBeLessThan(0)
  })

  it("increases energy with sustained ticks", () => {
    const shortHope = { ...defaultState, level: 0.5, isActive: true, sustainedTicks: 1 }
    const longHope = { ...defaultState, level: 0.5, isActive: true, sustainedTicks: 10 }
    const shortEffect = computeEffect(shortHope)
    const longEffect = computeEffect(longHope)
    expect(longEffect.energy).toBeGreaterThan(shortEffect.energy ?? 0)
  })
})
