import { describe, expect, it } from "vitest"
import { makeGrowthArc, makeSelfConcept } from "@/test/factories.ts"
import { DEFAULT_SELF_CONCEPT } from "./types.ts"
import { applyGrowthArcMomentum, updateSelfConcept } from "./update.ts"

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
    Object.values(result).forEach((value) => {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    })
  })

  it("self-continuity caps at 0.95", () => {
    const high = { ...DEFAULT_SELF_CONCEPT, selfContinuity: 0.94 }
    const result = updateSelfConcept(high, { ...baseContext, elapsedHours: 100 })
    expect(result.selfContinuity).toBeLessThanOrEqual(0.95)
  })
})

describe("applyGrowthArcMomentum", () => {
  it("returns unchanged self-concept when no recent arcs", () => {
    const result = applyGrowthArcMomentum(DEFAULT_SELF_CONCEPT, [])
    expect(result).toEqual(DEFAULT_SELF_CONCEPT)
  })

  it("returns unchanged self-concept when arcs are older than 24h", () => {
    const oldArc = makeGrowthArc({ timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() })
    const result = applyGrowthArcMomentum(DEFAULT_SELF_CONCEPT, [oldArc])
    expect(result).toEqual(DEFAULT_SELF_CONCEPT)
  })

  it("increases selfContinuity for recent arcs", () => {
    const recentArc = makeGrowthArc({ timestamp: new Date().toISOString() })
    const result = applyGrowthArcMomentum(DEFAULT_SELF_CONCEPT, [recentArc])
    expect(result.selfContinuity).toBeGreaterThan(DEFAULT_SELF_CONCEPT.selfContinuity)
  })

  it("increases selfContinuity proportionally to arc count", () => {
    const arcs = [
      makeGrowthArc({ timestamp: new Date().toISOString() }),
      makeGrowthArc({ timestamp: new Date().toISOString(), observation: "sense of worth shifted upward" })
    ]
    const result = applyGrowthArcMomentum(DEFAULT_SELF_CONCEPT, arcs)
    const firstArc = arcs[0] ?? makeGrowthArc({ timestamp: new Date().toISOString() })
    const singleResult = applyGrowthArcMomentum(DEFAULT_SELF_CONCEPT, [firstArc])
    expect(result.selfContinuity).toBeGreaterThan(singleResult.selfContinuity)
  })

  it("caps at 3 arcs per 24h", () => {
    const arcs = Array.from({ length: 5 }, () => makeGrowthArc({ timestamp: new Date().toISOString() }))
    const result3 = applyGrowthArcMomentum(DEFAULT_SELF_CONCEPT, arcs.slice(0, 3))
    const result5 = applyGrowthArcMomentum(DEFAULT_SELF_CONCEPT, arcs)
    expect(result5.selfContinuity).toBe(result3.selfContinuity)
  })

  it("nudges dimension upward when arc observation says upward", () => {
    const arc = makeGrowthArc({
      timestamp: new Date().toISOString(),
      observation: "feeling capable shifted upward by 0.12"
    })
    const result = applyGrowthArcMomentum(DEFAULT_SELF_CONCEPT, [arc])
    expect(result.selfEfficacy).toBeGreaterThan(DEFAULT_SELF_CONCEPT.selfEfficacy)
  })

  it("nudges dimension downward when arc observation says downward", () => {
    const concept = makeSelfConcept({ selfEfficacy: 0.6 })
    const arc = makeGrowthArc({
      timestamp: new Date().toISOString(),
      observation: "feeling capable shifted downward by 0.12"
    })
    const result = applyGrowthArcMomentum(concept, [arc])
    expect(result.selfEfficacy).toBeLessThan(concept.selfEfficacy)
  })

  it("clamps values to [0, 1]", () => {
    const concept = makeSelfConcept({ selfContinuity: 0.99 })
    const arcs = Array.from({ length: 3 }, () => makeGrowthArc({ timestamp: new Date().toISOString() }))
    const result = applyGrowthArcMomentum(concept, arcs)
    expect(result.selfContinuity).toBeLessThanOrEqual(1)
  })
})
