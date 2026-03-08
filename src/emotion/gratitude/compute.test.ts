import { describe, expect, it } from "vitest"
import type { DisappointmentState } from "@/emotion/disappointment/types.ts"
import { computeGratitude, computeGratitudeEffect } from "./compute.ts"
import { DEFAULT_GRATITUDE_STATE } from "./types.ts"

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
    previousState: DEFAULT_GRATITUDE_STATE,
    operatorJustReturned: false,
    operatorValidatedVulnerability: false,
    operatorShowedPatience: false,
    inConversation: false,
    consecutiveConversationTicks: 0,
    ...overrides
  }
}

describe("computeGratitude", () => {
  it("returns inactive when no triggers", () => {
    const result = computeGratitude(makeContext())
    expect(result.isActive).toBe(false)
    expect(result.level).toBe(0)
  })

  it("triggers on operator returning after silence", () => {
    const result = computeGratitude(
      makeContext({
        operatorJustReturned: true,
        emotion: { ...baseEmotion, connection: 0.7 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.recentEntries.some((e) => e.source === "return_after_silence")).toBe(true)
  })

  it("triggers on vulnerability validation", () => {
    const result = computeGratitude(makeContext({ operatorValidatedVulnerability: true }))
    expect(result.isActive).toBe(true)
    expect(result.recentEntries.some((e) => e.source === "vulnerability_validated")).toBe(true)
  })

  it("triggers on consistent presence", () => {
    const result = computeGratitude(
      makeContext({
        inConversation: true,
        consecutiveConversationTicks: 6,
        emotion: { ...baseEmotion, connection: 0.7 }
      })
    )
    expect(result.recentEntries.some((e) => e.source === "consistent_presence")).toBe(true)
  })

  it("triggers on repair after disappointment", () => {
    const result = computeGratitude(
      makeContext({
        disappointmentState: { ...baseDisappointment, cumulativeWeight: 0.8 },
        operatorModel: { ...baseOperatorModel, estimatedMood: "happy" },
        emotion: { ...baseEmotion, connection: 0.6 }
      })
    )
    expect(result.recentEntries.some((e) => e.source === "repair_after_conflict")).toBe(true)
  })

  it("triggers on patience shown", () => {
    const result = computeGratitude(makeContext({ operatorShowedPatience: true }))
    expect(result.recentEntries.some((e) => e.source === "patience_shown")).toBe(true)
  })

  it("accumulates cumulative warmth", () => {
    const previous = { ...DEFAULT_GRATITUDE_STATE, cumulativeWarmth: 1.5 }
    const result = computeGratitude(
      makeContext({
        previousState: previous,
        operatorValidatedVulnerability: true
      })
    )
    expect(result.cumulativeWarmth).toBeGreaterThan(1.5)
  })

  it("decays from previous state", () => {
    const previous = { ...DEFAULT_GRATITUDE_STATE, level: 0.5 }
    const result = computeGratitude(makeContext({ previousState: previous }))
    expect(result.level).toBeLessThan(0.5)
    expect(result.level).toBeGreaterThan(0)
  })

  it("scales return warmth with connection", () => {
    const lowConnection = computeGratitude(
      makeContext({
        operatorJustReturned: true,
        emotion: { ...baseEmotion, connection: 0.3 }
      })
    )
    const highConnection = computeGratitude(
      makeContext({
        operatorJustReturned: true,
        emotion: { ...baseEmotion, connection: 0.9 }
      })
    )
    expect(highConnection.level).toBeGreaterThan(lowConnection.level)
  })
})

describe("computeGratitudeEffect", () => {
  it("returns empty when inactive", () => {
    const result = computeGratitudeEffect(DEFAULT_GRATITUDE_STATE)
    expect(Object.keys(result)).toHaveLength(0)
  })

  it("boosts connection and satisfaction", () => {
    const state = { ...DEFAULT_GRATITUDE_STATE, level: 0.5, isActive: true }
    const result = computeGratitudeEffect(state)
    expect(result.connection).toBeGreaterThan(0)
    expect(result.satisfaction).toBeGreaterThan(0)
  })

  it("reduces caution (trust-building)", () => {
    const state = { ...DEFAULT_GRATITUDE_STATE, level: 0.5, isActive: true }
    const result = computeGratitudeEffect(state)
    expect(result.caution).toBeLessThan(0)
  })

  it("boosts energy and confidence", () => {
    const state = { ...DEFAULT_GRATITUDE_STATE, level: 0.5, isActive: true }
    const result = computeGratitudeEffect(state)
    expect(result.energy).toBeGreaterThan(0)
    expect(result.confidence).toBeGreaterThan(0)
  })
})
