import { describe, expect, it } from "vitest"
import {
  computeAllostasis,
  computeCoregulationBenefit,
  computeIsolationCost,
  computeIsolationEnergyDrain,
  computeIsolationStress
} from "./baseline.ts"
import { DEFAULT_ATTACHMENT } from "./types.ts"

const baseContext = {
  operatorSilenceMinutes: 120,
  inConversation: false,
  attachmentStyle: DEFAULT_ATTACHMENT,
  cortisol: 0.3
}

describe("computeIsolationCost", () => {
  it("returns 0 when in conversation", () => {
    expect(computeIsolationCost({ ...baseContext, inConversation: true })).toBe(0)
  })

  it("increases with silence duration", () => {
    const short = computeIsolationCost({ ...baseContext, operatorSilenceMinutes: 30 })
    const long = computeIsolationCost({ ...baseContext, operatorSilenceMinutes: 600 })
    expect(long).toBeGreaterThan(short)
  })

  it("is amplified by anxious attachment", () => {
    const anxious = computeIsolationCost({
      ...baseContext,
      attachmentStyle: { ...DEFAULT_ATTACHMENT, anxious: 0.9 }
    })
    const secure = computeIsolationCost({
      ...baseContext,
      attachmentStyle: { ...DEFAULT_ATTACHMENT, anxious: 0.1 }
    })
    expect(anxious).toBeGreaterThan(secure)
  })

  it("is dampened by avoidant attachment", () => {
    const avoidant = computeIsolationCost({
      ...baseContext,
      attachmentStyle: { ...DEFAULT_ATTACHMENT, avoidant: 0.9 }
    })
    const nonAvoidant = computeIsolationCost({
      ...baseContext,
      attachmentStyle: { ...DEFAULT_ATTACHMENT, avoidant: 0.1 }
    })
    expect(avoidant).toBeLessThan(nonAvoidant)
  })

  it("clamps to [0, 1]", () => {
    const extreme = computeIsolationCost({
      ...baseContext,
      operatorSilenceMinutes: 10000,
      attachmentStyle: { ...DEFAULT_ATTACHMENT, anxious: 1.0, avoidant: 0 }
    })
    expect(extreme).toBeLessThanOrEqual(1)
    expect(extreme).toBeGreaterThanOrEqual(0)
  })

  it("uses sub-linear time scaling (first hours matter most)", () => {
    const first60 = computeIsolationCost({ ...baseContext, operatorSilenceMinutes: 60 })
    const first120 = computeIsolationCost({ ...baseContext, operatorSilenceMinutes: 120 })
    const delta1 = first60
    const delta2 = first120 - first60
    expect(delta1).toBeGreaterThan(delta2)
  })
})

describe("computeCoregulationBenefit", () => {
  it("returns 0 when not in conversation", () => {
    expect(
      computeCoregulationBenefit({ inConversation: false, attachmentSecure: 0.5, operatorSilenceMinutes: 0 })
    ).toBe(0)
  })

  it("increases with secure attachment", () => {
    const secure = computeCoregulationBenefit({
      inConversation: true,
      attachmentSecure: 0.9,
      operatorSilenceMinutes: 0
    })
    const insecure = computeCoregulationBenefit({
      inConversation: true,
      attachmentSecure: 0.1,
      operatorSilenceMinutes: 0
    })
    expect(secure).toBeGreaterThan(insecure)
  })

  it("is positive when in conversation", () => {
    const result = computeCoregulationBenefit({
      inConversation: true,
      attachmentSecure: 0.5,
      operatorSilenceMinutes: 0
    })
    expect(result).toBeGreaterThan(0)
  })
})

describe("computeIsolationEnergyDrain", () => {
  it("returns 0 for zero isolation cost", () => {
    expect(computeIsolationEnergyDrain(0)).toBe(0)
  })

  it("scales linearly with isolation cost", () => {
    const low = computeIsolationEnergyDrain(0.2)
    const high = computeIsolationEnergyDrain(0.8)
    expect(high).toBeGreaterThan(low)
  })
})

describe("computeAllostasis", () => {
  it("increases when isolated", () => {
    const result = computeAllostasis({ previousAllostasis: 0.3, isolationCost: 0.5, coregulationBenefit: 0 })
    expect(result).toBeGreaterThan(0.3)
  })

  it("decreases when co-regulating", () => {
    const result = computeAllostasis({ previousAllostasis: 0.5, isolationCost: 0, coregulationBenefit: 0.5 })
    expect(result).toBeLessThan(0.5)
  })

  it("clamps to [0, 1]", () => {
    const high = computeAllostasis({ previousAllostasis: 0.99, isolationCost: 1, coregulationBenefit: 0 })
    expect(high).toBeLessThanOrEqual(1)

    const low = computeAllostasis({ previousAllostasis: 0.01, isolationCost: 0, coregulationBenefit: 1 })
    expect(low).toBeGreaterThanOrEqual(0)
  })
})

describe("computeIsolationStress", () => {
  it("returns all zero costs when in conversation", () => {
    const result = computeIsolationStress({
      operatorSilenceMinutes: 0,
      inConversation: true,
      attachmentStyle: DEFAULT_ATTACHMENT,
      cortisol: 0.3,
      previousAllostasis: 0.3
    })
    expect(result.isolationCost).toBe(0)
    expect(result.energyDrainRate).toBe(0)
    expect(result.coregulationBenefit).toBeGreaterThan(0)
  })

  it("returns elevated stress when isolated for long", () => {
    const result = computeIsolationStress({
      operatorSilenceMinutes: 480,
      inConversation: false,
      attachmentStyle: { ...DEFAULT_ATTACHMENT, anxious: 0.7 },
      cortisol: 0.6,
      previousAllostasis: 0.4
    })
    expect(result.isolationCost).toBeGreaterThan(0)
    expect(result.energyDrainRate).toBeGreaterThan(0)
    expect(result.allostasis).toBeGreaterThan(0.4)
  })
})
