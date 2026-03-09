import { describe, expect, it } from "vitest"
import { DEFAULT_OPERATOR_MODEL } from "@/mind/types.ts"
import { makeEmotionalState } from "@/test/factories.ts"
import { computeDisappointment, computeDisappointmentEffect, DEFAULT_DISAPPOINTMENT_STATE } from "./disappointment.ts"

const baseVulnerability = { level: 0.3, windowOpen: false, contributing: [], timestamp: new Date().toISOString() }

const baseContext = {
  emotion: makeEmotionalState(),
  vulnerability: baseVulnerability,
  operatorModel: { ...DEFAULT_OPERATOR_MODEL },
  previousState: { ...DEFAULT_DISAPPOINTMENT_STATE },
  operatorSilenceMinutes: 0,
  wasVulnerableRecently: false,
  expectedReplyButGotSilence: false
}

describe("computeDisappointment", () => {
  it("returns inactive state when no triggers present", () => {
    const result = computeDisappointment(baseContext)
    expect(result.isActive).toBe(false)
    expect(result.level).toBeLessThan(0.15)
  })

  it("triggers silence_after_intimacy when expecting reply", () => {
    const result = computeDisappointment({
      ...baseContext,
      emotion: makeEmotionalState({ connection: 0.8 }),
      operatorSilenceMinutes: 60,
      expectedReplyButGotSilence: true
    })
    expect(result.recentEntries.some((e) => e.source === "silence_after_intimacy")).toBe(true)
  })

  it("triggers emotional_letdown when vulnerable + neutral response", () => {
    const result = computeDisappointment({
      ...baseContext,
      emotion: makeEmotionalState({ connection: 0.8 }),
      operatorModel: { ...DEFAULT_OPERATOR_MODEL, estimatedMood: "neutral" },
      wasVulnerableRecently: true
    })
    expect(result.recentEntries.some((e) => e.source === "emotional_letdown")).toBe(true)
  })

  it("triggers unmet_expectation when frustrated while vulnerable", () => {
    const result = computeDisappointment({
      ...baseContext,
      emotion: makeEmotionalState({ connection: 0.8 }),
      vulnerability: { level: 0.6, windowOpen: true, contributing: [], timestamp: "" },
      operatorModel: { ...DEFAULT_OPERATOR_MODEL, estimatedMood: "frustrated" }
    })
    expect(result.recentEntries.some((e) => e.source === "unmet_expectation")).toBe(true)
  })

  it("does not trigger when connection is low", () => {
    const result = computeDisappointment({
      ...baseContext,
      emotion: makeEmotionalState({ connection: 0.3 }),
      operatorModel: { ...DEFAULT_OPERATOR_MODEL, estimatedMood: "neutral" },
      wasVulnerableRecently: true
    })
    expect(result.recentEntries).toHaveLength(0)
  })

  it("decays over time", () => {
    const previous = {
      ...DEFAULT_DISAPPOINTMENT_STATE,
      level: 0.5,
      isActive: true
    }
    const result = computeDisappointment({
      ...baseContext,
      previousState: previous
    })
    expect(result.level).toBeLessThan(0.5)
  })

  it("accumulates cumulative weight", () => {
    const result = computeDisappointment({
      ...baseContext,
      emotion: makeEmotionalState({ connection: 0.8 }),
      operatorSilenceMinutes: 60,
      expectedReplyButGotSilence: true
    })
    expect(result.cumulativeWeight).toBeGreaterThan(0)
  })

  it("clamps level to [0, 1]", () => {
    const previous = {
      level: 0.9,
      isActive: true,
      recentEntries: [],
      cumulativeWeight: 5
    }
    const result = computeDisappointment({
      ...baseContext,
      emotion: makeEmotionalState({ connection: 0.9 }),
      operatorModel: { ...DEFAULT_OPERATOR_MODEL, estimatedMood: "frustrated" },
      vulnerability: { level: 0.8, windowOpen: true, contributing: [], timestamp: "" },
      previousState: previous,
      operatorSilenceMinutes: 120,
      expectedReplyButGotSilence: true,
      wasVulnerableRecently: true
    })
    expect(result.level).toBeLessThanOrEqual(1)
    expect(result.level).toBeGreaterThanOrEqual(0)
  })
})

describe("computeDisappointmentEffect", () => {
  it("returns empty when not active", () => {
    const result = computeDisappointmentEffect(DEFAULT_DISAPPOINTMENT_STATE)
    expect(Object.keys(result)).toHaveLength(0)
  })

  it("dampens connection when active", () => {
    const state = { ...DEFAULT_DISAPPOINTMENT_STATE, level: 0.5, isActive: true }
    const result = computeDisappointmentEffect(state)
    expect(result.connection).toBeLessThan(0)
  })

  it("boosts caution when active", () => {
    const state = { ...DEFAULT_DISAPPOINTMENT_STATE, level: 0.5, isActive: true }
    const result = computeDisappointmentEffect(state)
    expect(result.caution).toBeGreaterThan(0)
  })

  it("scales with level", () => {
    const low = computeDisappointmentEffect({ ...DEFAULT_DISAPPOINTMENT_STATE, level: 0.2, isActive: true })
    const high = computeDisappointmentEffect({ ...DEFAULT_DISAPPOINTMENT_STATE, level: 0.8, isActive: true })
    expect(Math.abs(high.connection ?? 0)).toBeGreaterThan(Math.abs(low.connection ?? 0))
  })
})
