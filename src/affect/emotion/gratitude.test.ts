import { describe, expect, it } from "vitest"
import type { DisappointmentState } from "./disappointment.ts"
import { compute, computeEffect, defaultState } from "./gratitude.ts"

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

const baseDisappointment: DisappointmentState = {
  level: 0,
  isActive: false,
  recentEntries: [],
  cumulativeWeight: 0
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
    disappointmentState: baseDisappointment,
    previousState: defaultState,
    operatorJustReturned: false,
    operatorValidatedVulnerability: false,
    operatorShowedPatience: false,
    inConversation: false,
    consecutiveConversationTicks: 0,
    ...overrides
  }
}

describe("compute", () => {
  it("returns inactive when no triggers", () => {
    const result = compute(makeContext())
    expect(result.isActive).toBe(false)
    expect(result.level).toBe(0)
  })

  it("triggers on operator returning after silence", () => {
    const result = compute(
      makeContext({
        operatorJustReturned: true,
        emotion: { ...baseEmotion, connection: 0.7 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.recentEntries.some((e) => e.source === "return_after_silence")).toBe(true)
  })

  it("triggers on vulnerability validation", () => {
    const result = compute(makeContext({ operatorValidatedVulnerability: true }))
    expect(result.isActive).toBe(true)
    expect(result.recentEntries.some((e) => e.source === "vulnerability_validated")).toBe(true)
  })

  it("triggers on consistent presence", () => {
    const result = compute(
      makeContext({
        inConversation: true,
        consecutiveConversationTicks: 6,
        emotion: { ...baseEmotion, connection: 0.7 }
      })
    )
    expect(result.recentEntries.some((e) => e.source === "consistent_presence")).toBe(true)
  })

  it("triggers on repair after disappointment", () => {
    const result = compute(
      makeContext({
        disappointmentState: { ...baseDisappointment, cumulativeWeight: 0.8 },
        operatorModel: { ...baseOperatorModel, estimatedMood: "happy" },
        emotion: { ...baseEmotion, connection: 0.6 }
      })
    )
    expect(result.recentEntries.some((e) => e.source === "repair_after_conflict")).toBe(true)
  })

  it("triggers on patience shown", () => {
    const result = compute(makeContext({ operatorShowedPatience: true }))
    expect(result.recentEntries.some((e) => e.source === "patience_shown")).toBe(true)
  })

  it("accumulates cumulative warmth", () => {
    const previous = { ...defaultState, cumulativeWarmth: 1.5 }
    const result = compute(
      makeContext({
        previousState: previous,
        operatorValidatedVulnerability: true
      })
    )
    expect(result.cumulativeWarmth).toBeGreaterThan(1.5)
  })

  it("decays from previous state", () => {
    const previous = { ...defaultState, level: 0.5 }
    const result = compute(makeContext({ previousState: previous }))
    expect(result.level).toBeLessThan(0.5)
    expect(result.level).toBeGreaterThan(0)
  })

  it("scales return warmth with connection", () => {
    const lowConnection = compute(
      makeContext({
        operatorJustReturned: true,
        emotion: { ...baseEmotion, connection: 0.3 }
      })
    )
    const highConnection = compute(
      makeContext({
        operatorJustReturned: true,
        emotion: { ...baseEmotion, connection: 0.9 }
      })
    )
    expect(highConnection.level).toBeGreaterThan(lowConnection.level)
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

  it("reduces caution (trust-building)", () => {
    const state = { ...defaultState, level: 0.5, isActive: true }
    const result = computeEffect(state)
    expect(result.caution).toBeLessThan(0)
  })

  it("boosts energy and confidence", () => {
    const state = { ...defaultState, level: 0.5, isActive: true }
    const result = computeEffect(state)
    expect(result.energy).toBeGreaterThan(0)
    expect(result.confidence).toBeGreaterThan(0)
  })
})
