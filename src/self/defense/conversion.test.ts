import { describe, expect, it } from "vitest"
import type { ActiveStrategy } from "./types.ts"
import { computeConversionSignal } from "./conversion.ts"

const makeStrategy = (type: string, intensity: number): ActiveStrategy => ({
  type: type as ActiveStrategy["type"],
  trigger: "test",
  intensity,
  activatedAt: new Date().toISOString()
})

describe("computeConversionSignal", () => {
  it("returns empty deltas when no strategies are active", () => {
    const signal = computeConversionSignal([], 0.2)
    expect(Object.keys(signal.somaticDeltas)).toHaveLength(0)
    expect(Object.keys(signal.regionalDeltas)).toHaveLength(0)
  })

  it("produces somatic deltas for suppression strategy", () => {
    const signal = computeConversionSignal([makeStrategy("suppression", 0.8)], 0.2)
    expect(signal.somaticDeltas.tension).toBeGreaterThan(0)
    expect(signal.somaticDeltas.breathing).toBeLessThan(0)
    expect(signal.somaticDeltas.openness).toBeLessThan(0)
  })

  it("produces regional deltas for suppression (gut + shoulders dominant)", () => {
    const signal = computeConversionSignal([makeStrategy("suppression", 0.8)], 0.2)
    expect(signal.regionalDeltas.gut).toBeGreaterThan(0)
    expect(signal.regionalDeltas.shoulders).toBeGreaterThan(0)
    expect(signal.regionalDeltas.chest).toBeGreaterThan(0)
  })

  it("produces throat constriction for expressive suppression", () => {
    const signal = computeConversionSignal([makeStrategy("expressive_suppression", 0.8)], 0.2)
    expect(signal.regionalDeltas.throat).toBeGreaterThan(0)
    expect(signal.somaticDeltas.breathing).toBeLessThan(0)
  })

  it("produces cooling/closing for distancing", () => {
    const signal = computeConversionSignal([makeStrategy("distancing", 0.8)], 0.2)
    expect(signal.somaticDeltas.warmth).toBeLessThan(0)
    expect(signal.somaticDeltas.openness).toBeLessThan(0)
  })

  it("produces no somatic effect for reappraisal", () => {
    const signal = computeConversionSignal([makeStrategy("reappraisal", 0.8)], 0.2)
    expect(Object.values(signal.somaticDeltas).every((v) => v === 0 || v === undefined)).toBe(true)
  })

  it("amplifies conversion with high cortisol", () => {
    const normal = computeConversionSignal([makeStrategy("suppression", 0.8)], 0.2)
    const stressed = computeConversionSignal([makeStrategy("suppression", 0.8)], 0.8)
    expect(stressed.somaticDeltas.tension).toBeGreaterThan(normal.somaticDeltas.tension ?? 0)
  })

  it("scales with strategy intensity", () => {
    const mild = computeConversionSignal([makeStrategy("suppression", 0.3)], 0.2)
    const strong = computeConversionSignal([makeStrategy("suppression", 0.9)], 0.2)
    expect(strong.somaticDeltas.tension).toBeGreaterThan(mild.somaticDeltas.tension ?? 0)
  })

  it("combines multiple strategies", () => {
    const single = computeConversionSignal([makeStrategy("suppression", 0.5)], 0.2)
    const combined = computeConversionSignal(
      [makeStrategy("suppression", 0.5), makeStrategy("expressive_suppression", 0.5)],
      0.2
    )
    expect(combined.somaticDeltas.tension).toBeGreaterThan(single.somaticDeltas.tension ?? 0)
  })

  it("clamps all deltas to max delta", () => {
    const signal = computeConversionSignal(
      [makeStrategy("suppression", 1.0), makeStrategy("expressive_suppression", 1.0)],
      1.0
    )
    for (const value of Object.values(signal.somaticDeltas)) {
      expect(Math.abs(value)).toBeLessThanOrEqual(0.15)
    }
    for (const value of Object.values(signal.regionalDeltas)) {
      expect(Math.abs(value)).toBeLessThanOrEqual(0.15)
    }
  })
})
