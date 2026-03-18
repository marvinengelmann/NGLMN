import { describe, expect, it } from "vitest"
import { computeAttentionalGain, computeFELearningRate, computeVolatilityEstimate } from "./dynamics.ts"

describe("computeVolatilityEstimate", () => {
  it("returns default for insufficient history", () => {
    expect(computeVolatilityEstimate([])).toBe(0.3)
    expect(computeVolatilityEstimate([0.5])).toBe(0.3)
  })

  it("returns 0 for constant history", () => {
    expect(computeVolatilityEstimate([0.5, 0.5, 0.5, 0.5])).toBe(0)
  })

  it("returns higher volatility for variable history", () => {
    const stable = computeVolatilityEstimate([0.5, 0.5, 0.5, 0.5])
    const variable = computeVolatilityEstimate([0.2, 0.8, 0.1, 0.9])
    expect(variable).toBeGreaterThan(stable)
  })

  it("stays within [0, 1]", () => {
    const result = computeVolatilityEstimate([0, 1, 0, 1, 0, 1])
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThanOrEqual(1)
  })
})

describe("computeFELearningRate", () => {
  it("increases with volatility", () => {
    const low = computeFELearningRate(0.1, 0.3, 0.5)
    const high = computeFELearningRate(0.9, 0.3, 0.5)
    expect(high).toBeGreaterThan(low)
  })

  it("decreases with allostatic load", () => {
    const fresh = computeFELearningRate(0.5, 0, 0.5)
    const burned = computeFELearningRate(0.5, 0.8, 0.5)
    expect(fresh).toBeGreaterThan(burned)
  })

  it("increases with dopamine", () => {
    const lowDA = computeFELearningRate(0.5, 0.3, 0.1)
    const highDA = computeFELearningRate(0.5, 0.3, 0.9)
    expect(highDA).toBeGreaterThan(lowDA)
  })

  it("stays within bounds", () => {
    const extreme = computeFELearningRate(1, 0, 1)
    expect(extreme).toBeLessThanOrEqual(1.5)
    expect(extreme).toBeGreaterThanOrEqual(0.3)

    const minimal = computeFELearningRate(0, 1, 0)
    expect(minimal).toBeGreaterThanOrEqual(0.3)
  })
})

describe("computeAttentionalGain", () => {
  it("increases with total FE (narrowing under stress)", () => {
    const low = computeAttentionalGain(0.1, 0.3)
    const high = computeAttentionalGain(0.9, 0.3)
    expect(high).toBeGreaterThan(low)
  })

  it("stays within bounds", () => {
    expect(computeAttentionalGain(0, 0)).toBeGreaterThanOrEqual(0.5)
    expect(computeAttentionalGain(1, 1)).toBeLessThanOrEqual(2.0)
  })
})
