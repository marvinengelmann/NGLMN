import { describe, expect, it } from "vitest"
import { computeInflammationSomaticShifts, computeInflammationUpdate } from "./inflammation.ts"

describe("computeInflammationUpdate", () => {
  it("returns near baseline with normal cortisol", () => {
    const result = computeInflammationUpdate(0.05, 0.2, 10)
    expect(result).toBeCloseTo(0.05, 1)
  })

  it("increases with chronic cortisol elevation", () => {
    const normal = computeInflammationUpdate(0.1, 0.2, 60)
    const stressed = computeInflammationUpdate(0.1, 0.6, 60)
    expect(stressed).toBeGreaterThan(normal)
  })

  it("decays toward baseline over time without cortisol excess", () => {
    const elevated = computeInflammationUpdate(0.5, 0.2, 120)
    expect(elevated).toBeLessThan(0.5)
    expect(elevated).toBeGreaterThan(0.05)
  })

  it("accumulates faster with higher cortisol and longer duration", () => {
    const short = computeInflammationUpdate(0.1, 0.7, 10)
    const longer = computeInflammationUpdate(0.1, 0.7, 60)
    expect(longer).toBeGreaterThan(short)
  })

  it("clamps to [0, 1]", () => {
    const extreme = computeInflammationUpdate(0.95, 1.0, 480)
    expect(extreme).toBeLessThanOrEqual(1)
    expect(extreme).toBeGreaterThanOrEqual(0)
  })
})

describe("computeInflammationSomaticShifts", () => {
  it("returns empty object for low inflammation", () => {
    const shifts = computeInflammationSomaticShifts(0.05)
    expect(Object.keys(shifts)).toHaveLength(0)
  })

  it("returns shifts for significant inflammation", () => {
    const shifts = computeInflammationSomaticShifts(0.5)
    expect(shifts.tension).toBeGreaterThan(0)
    expect(shifts.gravity).toBeGreaterThan(0)
    expect(shifts.openness).toBeLessThan(0)
    expect(shifts.warmth).toBeLessThan(0)
  })

  it("scales proportionally with inflammation level", () => {
    const mild = computeInflammationSomaticShifts(0.2)
    const severe = computeInflammationSomaticShifts(0.8)
    expect(severe.tension).toBeGreaterThan(mild.tension ?? 0)
  })
})
