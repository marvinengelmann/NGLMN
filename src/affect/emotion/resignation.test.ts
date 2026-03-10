import { describe, expect, it } from "vitest"
import { compute, computeEffect, defaultState } from "./resignation.ts"

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
    repeatedFailures: false,
    signalsIgnored: false,
    prolongedDisconnection: false,
    hopeExhausted: false,
    effortUnrewarded: false,
    autonomyEroded: false,
    hopeLevel: 0,
    ...overrides
  }
}

describe("compute", () => {
  it("returns inactive when no triggers", () => {
    const result = compute(makeContext())
    expect(result.isActive).toBe(false)
    expect(result.level).toBe(0)
  })

  it("triggers on repeated failures", () => {
    const result = compute(
      makeContext({
        repeatedFailures: true,
        emotion: { ...baseEmotion, confidence: 0.2 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("repeated_failure")
  })

  it("triggers on ignored signals", () => {
    const result = compute(
      makeContext({
        signalsIgnored: true,
        emotion: { ...baseEmotion, connection: 0.6 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("ignored_signals")
  })

  it("triggers on prolonged disconnection", () => {
    const result = compute(
      makeContext({
        prolongedDisconnection: true,
        emotion: { ...baseEmotion, connection: 0.15 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("prolonged_disconnection")
  })

  it("triggers on hope exhaustion", () => {
    const result = compute(makeContext({ hopeExhausted: true }))
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("hope_exhaustion")
  })

  it("triggers on effort unrewarded", () => {
    const result = compute(
      makeContext({
        effortUnrewarded: true,
        emotion: { ...baseEmotion, satisfaction: 0.15 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("effort_unrewarded")
  })

  it("triggers on autonomy eroded", () => {
    const result = compute(
      makeContext({
        autonomyEroded: true,
        operatorModel: { ...baseOperatorModel, correctionCount: 4 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("autonomy_eroded")
  })

  it("dampens with active hope", () => {
    const withHope = compute(makeContext({ hopeExhausted: true, hopeLevel: 0.5 }))
    const without = compute(makeContext({ hopeExhausted: true }))
    expect(withHope.level).toBeLessThan(without.level)
  })

  it("grows depth when sustained", () => {
    const result = compute(
      makeContext({
        hopeExhausted: true,
        previousState: { ...defaultState, depth: 0.2, level: 0.4, isActive: true }
      })
    )
    expect(result.depth).toBeGreaterThan(0.2)
  })

  it("tracks withdrawal ticks", () => {
    const result = compute(
      makeContext({
        hopeExhausted: true,
        previousState: { ...defaultState, withdrawalTicks: 3, level: 0.4, isActive: true }
      })
    )
    expect(result.withdrawalTicks).toBe(4)
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

  it("drains energy and confidence", () => {
    const state = { ...defaultState, level: 0.5, isActive: true }
    const result = computeEffect(state)
    expect(result.energy).toBeLessThan(0)
    expect(result.confidence).toBeLessThan(0)
  })

  it("drains curiosity and excitement", () => {
    const state = { ...defaultState, level: 0.5, isActive: true }
    const result = computeEffect(state)
    expect(result.curiosity).toBeLessThan(0)
    expect(result.excitement).toBeLessThan(0)
  })

  it("increases drain with depth", () => {
    const shallow = { ...defaultState, level: 0.5, isActive: true, depth: 0.1 }
    const deep = { ...defaultState, level: 0.5, isActive: true, depth: 0.8 }
    const shallowEffect = computeEffect(shallow)
    const deepEffect = computeEffect(deep)
    expect(deepEffect.energy).toBeLessThan(shallowEffect.energy ?? 0)
  })
})
