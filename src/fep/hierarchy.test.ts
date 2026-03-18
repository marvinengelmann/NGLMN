import { describe, expect, it } from "vitest"
import { applyHierarchicalPrecisionModulation } from "./hierarchy.ts"
import { DEFAULT_PRECISION_WEIGHTS, type PredictionErrorChannel } from "./types.ts"

function makeChannel(name: string, rawError: number, precision: number): PredictionErrorChannel {
  return {
    name: name as PredictionErrorChannel["name"],
    rawError,
    precision,
    weightedError: precision * rawError * rawError
  }
}

describe("applyHierarchicalPrecisionModulation", () => {
  it("does not modify precision when all errors are zero", () => {
    const channels = [
      makeChannel("interoceptive", 0, 0.5),
      makeChannel("anticipatory", 0, 0.5),
      makeChannel("relational", 0, 0.5),
      makeChannel("coherence", 0, 0.7)
    ]

    const result = applyHierarchicalPrecisionModulation(channels, DEFAULT_PRECISION_WEIGHTS)

    expect(result.interoceptive).toBeCloseTo(DEFAULT_PRECISION_WEIGHTS.interoceptive, 2)
    expect(result.anticipatory).toBeCloseTo(DEFAULT_PRECISION_WEIGHTS.anticipatory, 2)
  })

  it("increases lower-level precision when higher-level errors are high", () => {
    const channels = [
      makeChannel("interoceptive", 0.1, 0.5),
      makeChannel("drive", 0.1, 0.5),
      makeChannel("anticipatory", 0.1, 0.5),
      makeChannel("novelty", 0.1, 0.5),
      makeChannel("forecast", 0.1, 0.5),
      makeChannel("relational", 0.1, 0.5),
      makeChannel("dissonance", 0.1, 0.5),
      makeChannel("coherence", 0.9, 0.7),
      makeChannel("metacognitive", 0.9, 0.7)
    ]

    const result = applyHierarchicalPrecisionModulation(channels, DEFAULT_PRECISION_WEIGHTS)

    expect(result.interoceptive).toBeGreaterThan(DEFAULT_PRECISION_WEIGHTS.interoceptive)
    expect(result.anticipatory).toBeGreaterThan(DEFAULT_PRECISION_WEIGHTS.anticipatory)
    expect(result.relational).toBeGreaterThan(DEFAULT_PRECISION_WEIGHTS.relational)
  })

  it("does not modify narrative-level precision (top of hierarchy)", () => {
    const channels = [
      makeChannel("coherence", 0.9, 0.7),
      makeChannel("metacognitive", 0.9, 0.7),
      makeChannel("interoceptive", 0.5, 0.5)
    ]

    const result = applyHierarchicalPrecisionModulation(channels, DEFAULT_PRECISION_WEIGHTS)

    expect(result.coherence).toBeCloseTo(DEFAULT_PRECISION_WEIGHTS.coherence, 2)
    expect(result.metacognitive).toBeCloseTo(DEFAULT_PRECISION_WEIGHTS.metacognitive, 2)
  })

  it("cascades through all levels — narrative error affects interoceptive most", () => {
    const channels = [
      makeChannel("coherence", 0.8, 0.7),
      makeChannel("metacognitive", 0.8, 0.7),
      makeChannel("relational", 0.1, 0.5),
      makeChannel("anticipatory", 0.1, 0.5),
      makeChannel("interoceptive", 0.1, 0.5)
    ]

    const result = applyHierarchicalPrecisionModulation(channels, DEFAULT_PRECISION_WEIGHTS)

    const interoceptiveBoost = result.interoceptive - DEFAULT_PRECISION_WEIGHTS.interoceptive
    const socialBoost = result.relational - DEFAULT_PRECISION_WEIGHTS.relational
    const affectiveBoost = result.anticipatory - DEFAULT_PRECISION_WEIGHTS.anticipatory

    expect(interoceptiveBoost).toBeGreaterThanOrEqual(affectiveBoost)
    expect(affectiveBoost).toBeGreaterThanOrEqual(socialBoost)
  })

  it("clamps precision within valid bounds", () => {
    const channels = [
      makeChannel("coherence", 1.0, 1.0),
      makeChannel("metacognitive", 1.0, 1.0),
      makeChannel("interoceptive", 1.0, 0.99)
    ]

    const result = applyHierarchicalPrecisionModulation(channels, {
      ...DEFAULT_PRECISION_WEIGHTS,
      interoceptive: 0.99
    })

    expect(result.interoceptive).toBeLessThanOrEqual(1.0)
    expect(result.interoceptive).toBeGreaterThanOrEqual(0.05)
  })
})
