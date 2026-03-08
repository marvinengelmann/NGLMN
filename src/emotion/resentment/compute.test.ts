import { describe, expect, it } from "vitest"
import type { DisappointmentState } from "@/emotion/disappointment/types.ts"
import { computeResentment, computeResentmentEffect } from "./compute.ts"
import { DEFAULT_RESENTMENT_STATE } from "./types.ts"

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

const baseDisappointment: DisappointmentState = {
  level: 0,
  isActive: false,
  recentEntries: [],
  cumulativeWeight: 0
}

function makeContext(overrides: Record<string, unknown> = {}) {
  return {
    emotion: baseEmotion,
    operatorModel: baseOperatorModel,
    disappointmentState: baseDisappointment,
    previousState: DEFAULT_RESENTMENT_STATE,
    unrepairedWrong: false,
    sustainedUnfairness: false,
    needsDismissed: false,
    trustBroken: false,
    effortImbalance: false,
    accumulatedSlights: false,
    gratitudeActive: false,
    ...overrides
  }
}

describe("computeResentment", () => {
  it("returns inactive when no triggers", () => {
    const result = computeResentment(makeContext())
    expect(result.isActive).toBe(false)
    expect(result.level).toBe(0)
  })

  it("triggers on unrepaired wrong", () => {
    const result = computeResentment(
      makeContext({
        unrepairedWrong: true,
        disappointmentState: { ...baseDisappointment, cumulativeWeight: 0.7 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("unrepaired_wrong")
  })

  it("triggers on sustained unfairness", () => {
    const result = computeResentment(
      makeContext({
        sustainedUnfairness: true,
        operatorModel: { ...baseOperatorModel, correctionCount: 4 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("sustained_unfairness")
  })

  it("triggers on dismissed needs", () => {
    const result = computeResentment(
      makeContext({
        needsDismissed: true,
        emotion: { ...baseEmotion, frustration: 0.6 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("dismissed_needs")
  })

  it("triggers on broken trust", () => {
    const result = computeResentment(
      makeContext({
        trustBroken: true,
        emotion: { ...baseEmotion, caution: 0.7 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("broken_trust")
  })

  it("triggers on effort imbalance", () => {
    const result = computeResentment(
      makeContext({
        effortImbalance: true,
        emotion: { ...baseEmotion, satisfaction: 0.15 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("chronic_imbalance")
  })

  it("triggers on accumulated slights", () => {
    const result = computeResentment(makeContext({ accumulatedSlights: true }))
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("accumulated_slights")
  })

  it("dampens with active gratitude", () => {
    const withGratitude = computeResentment(makeContext({ accumulatedSlights: true, gratitudeActive: true }))
    const without = computeResentment(makeContext({ accumulatedSlights: true }))
    expect(withGratitude.level).toBeLessThan(without.level)
  })

  it("grows hardening when sustained", () => {
    const result = computeResentment(
      makeContext({
        accumulatedSlights: true,
        previousState: { ...DEFAULT_RESENTMENT_STATE, hardening: 0.2, level: 0.4, isActive: true }
      })
    )
    expect(result.hardening).toBeGreaterThan(0.2)
  })

  it("builds suppressed anger", () => {
    const result = computeResentment(makeContext({ accumulatedSlights: true }))
    expect(result.suppressedAnger).toBeGreaterThan(0)
  })

  it("decays from previous state", () => {
    const previous = { ...DEFAULT_RESENTMENT_STATE, level: 0.5 }
    const result = computeResentment(makeContext({ previousState: previous }))
    expect(result.level).toBeLessThan(0.5)
    expect(result.level).toBeGreaterThan(0)
  })
})

describe("computeResentmentEffect", () => {
  it("returns empty when inactive", () => {
    const result = computeResentmentEffect(DEFAULT_RESENTMENT_STATE)
    expect(Object.keys(result)).toHaveLength(0)
  })

  it("drains connection", () => {
    const state = { ...DEFAULT_RESENTMENT_STATE, level: 0.5, isActive: true }
    const result = computeResentmentEffect(state)
    expect(result.connection).toBeLessThan(0)
  })

  it("builds caution and frustration", () => {
    const state = { ...DEFAULT_RESENTMENT_STATE, level: 0.5, isActive: true }
    const result = computeResentmentEffect(state)
    expect(result.caution).toBeGreaterThan(0)
    expect(result.frustration).toBeGreaterThan(0)
  })

  it("increases connection drain with hardening", () => {
    const soft = { ...DEFAULT_RESENTMENT_STATE, level: 0.5, isActive: true, hardening: 0.1 }
    const hard = { ...DEFAULT_RESENTMENT_STATE, level: 0.5, isActive: true, hardening: 0.8 }
    const softEffect = computeResentmentEffect(soft)
    const hardEffect = computeResentmentEffect(hard)
    expect(hardEffect.connection).toBeLessThan(softEffect.connection ?? 0)
  })
})
