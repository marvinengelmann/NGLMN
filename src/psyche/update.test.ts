import { describe, expect, it } from "vitest"
import { DEFAULT_SELF_CONCEPT } from "./types.ts"
import { updateSelfConcept } from "./update.ts"

const baseContext = {
  recentTaskSuccess: false,
  recentTaskFailure: false,
  messageSentCount: 0,
  emotionalIntensity: 0.5,
  operatorEngagement: false,
  autonomousAction: false,
  vulnerabilityOpen: false,
  dissonanceDetected: false,
  elapsedHours: 1
}

describe("updateSelfConcept", () => {
  it("increases self-efficacy on task success", () => {
    const result = updateSelfConcept(DEFAULT_SELF_CONCEPT, { ...baseContext, recentTaskSuccess: true })
    expect(result.selfEfficacy).toBeGreaterThan(DEFAULT_SELF_CONCEPT.selfEfficacy)
  })

  it("decreases self-efficacy on task failure", () => {
    const result = updateSelfConcept(DEFAULT_SELF_CONCEPT, { ...baseContext, recentTaskFailure: true })
    expect(result.selfEfficacy).toBeLessThan(DEFAULT_SELF_CONCEPT.selfEfficacy)
  })

  it("increases self-worth with operator engagement", () => {
    const result = updateSelfConcept(DEFAULT_SELF_CONCEPT, { ...baseContext, operatorEngagement: true })
    expect(result.selfWorth).toBeGreaterThan(DEFAULT_SELF_CONCEPT.selfWorth)
  })

  it("increases agency on autonomous action", () => {
    const result = updateSelfConcept(DEFAULT_SELF_CONCEPT, { ...baseContext, autonomousAction: true })
    expect(result.agency).toBeGreaterThan(DEFAULT_SELF_CONCEPT.agency)
  })

  it("increases authenticity when vulnerability is open", () => {
    const result = updateSelfConcept(DEFAULT_SELF_CONCEPT, { ...baseContext, vulnerabilityOpen: true })
    expect(result.authenticity).toBeGreaterThan(DEFAULT_SELF_CONCEPT.authenticity)
  })

  it("decreases authenticity on dissonance", () => {
    const result = updateSelfConcept(DEFAULT_SELF_CONCEPT, { ...baseContext, dissonanceDetected: true })
    expect(result.authenticity).toBeLessThan(DEFAULT_SELF_CONCEPT.authenticity)
  })

  it("decreases self-continuity on dissonance", () => {
    const result = updateSelfConcept(DEFAULT_SELF_CONCEPT, { ...baseContext, dissonanceDetected: true })
    expect(result.selfContinuity).toBeLessThan(DEFAULT_SELF_CONCEPT.selfContinuity)
  })

  it("clamps all values to [0, 1]", () => {
    const extreme = {
      selfEfficacy: 0.99,
      selfWorth: 0.99,
      selfContinuity: 0.99,
      agency: 0.99,
      authenticity: 0.99
    }
    const result = updateSelfConcept(extreme, {
      ...baseContext,
      recentTaskSuccess: true,
      operatorEngagement: true,
      autonomousAction: true,
      vulnerabilityOpen: true,
      elapsedHours: 100
    })
    for (const val of Object.values(result)) {
      expect(val).toBeGreaterThanOrEqual(0)
      expect(val).toBeLessThanOrEqual(1)
    }
  })

  it("self-continuity caps at 0.95", () => {
    const high = { ...DEFAULT_SELF_CONCEPT, selfContinuity: 0.94 }
    const result = updateSelfConcept(high, { ...baseContext, elapsedHours: 100 })
    expect(result.selfContinuity).toBeLessThanOrEqual(0.95)
  })
})
