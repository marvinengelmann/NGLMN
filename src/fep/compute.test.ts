import { describe, expect, it } from "vitest"
import {
  computeAccuracyTerm,
  computeAllostaticLoad,
  computeComplexityTerm,
  computeFreeEnergyDecomposition,
  computeTrend,
  findDominantChannel
} from "./compute.ts"
import type { PredictionErrorChannel } from "./types.ts"

function makeChannel(
  name: PredictionErrorChannel["name"],
  rawError: number,
  precision: number
): PredictionErrorChannel {
  return { name, rawError, precision, weightedError: precision * rawError * rawError }
}

describe("computeAccuracyTerm", () => {
  it("returns 0 for empty channels", () => {
    expect(computeAccuracyTerm([])).toBe(0)
  })

  it("returns 0 for zero-error channels", () => {
    const channels = [makeChannel("interoceptive", 0, 1), makeChannel("anticipatory", 0, 0.8)]
    expect(computeAccuracyTerm(channels)).toBe(0)
  })

  it("computes weighted PE correctly", () => {
    const channels = [makeChannel("interoceptive", 0.5, 1.0)]
    expect(computeAccuracyTerm(channels)).toBeCloseTo(0.25, 2)
  })

  it("averages across channels", () => {
    const channels = [makeChannel("interoceptive", 1.0, 1.0), makeChannel("anticipatory", 0, 1.0)]
    expect(computeAccuracyTerm(channels)).toBeCloseTo(0.5, 2)
  })

  it("precision-weights the errors", () => {
    const highPrecision = [makeChannel("interoceptive", 0.5, 1.0)]
    const lowPrecision = [makeChannel("interoceptive", 0.5, 0.1)]
    expect(computeAccuracyTerm(highPrecision)).toBeGreaterThan(computeAccuracyTerm(lowPrecision))
  })
})

describe("computeComplexityTerm", () => {
  it("returns 0 for a perfectly coherent system with no active strategies", () => {
    const result = computeComplexityTerm({
      coherenceScore: 1,
      dissonanceScore: 0,
      activeStrategyCount: 0,
      forecastAccuracy: 1
    })
    expect(result).toBe(0)
  })

  it("returns high complexity for maximally distorted state", () => {
    const result = computeComplexityTerm({
      coherenceScore: 0,
      dissonanceScore: 1,
      activeStrategyCount: 8,
      forecastAccuracy: 0
    })
    expect(result).toBeCloseTo(1, 1)
  })

  it("strategy count contributes proportionally", () => {
    const noStrategies = computeComplexityTerm({
      coherenceScore: 0.7,
      dissonanceScore: 0.2,
      activeStrategyCount: 0,
      forecastAccuracy: 0.5
    })
    const withStrategies = computeComplexityTerm({
      coherenceScore: 0.7,
      dissonanceScore: 0.2,
      activeStrategyCount: 4,
      forecastAccuracy: 0.5
    })
    expect(withStrategies).toBeGreaterThan(noStrategies)
  })
})

describe("computeFreeEnergyDecomposition", () => {
  it("combines accuracy and complexity", () => {
    const channels = [makeChannel("interoceptive", 0.8, 0.9)]
    const result = computeFreeEnergyDecomposition(channels, {
      coherenceScore: 0.5,
      dissonanceScore: 0.3,
      activeStrategyCount: 2,
      forecastAccuracy: 0.6
    })
    expect(result.accuracy).toBeGreaterThan(0)
    expect(result.complexity).toBeGreaterThan(0)
    expect(result.total).toBeGreaterThan(0)
    expect(result.total).toBeLessThanOrEqual(1)
  })
})

describe("computeAllostaticLoad", () => {
  it("moves toward current FE slowly", () => {
    const load = computeAllostaticLoad(0, 1.0)
    expect(load).toBeCloseTo(0.03, 2)
  })

  it("stays at 0 when FE is 0", () => {
    expect(computeAllostaticLoad(0, 0)).toBe(0)
  })

  it("decays when FE drops", () => {
    const load = computeAllostaticLoad(0.5, 0)
    expect(load).toBeLessThan(0.5)
    expect(load).toBeGreaterThan(0)
  })
})

describe("computeTrend", () => {
  it("returns 0 for insufficient history", () => {
    expect(computeTrend([])).toBe(0)
    expect(computeTrend([0.5])).toBe(0)
  })

  it("returns positive for rising FE", () => {
    const result = computeTrend([0.2, 0.3, 0.4, 0.5, 0.6])
    expect(result).toBeGreaterThan(0)
  })

  it("returns negative for falling FE", () => {
    const result = computeTrend([0.6, 0.5, 0.4, 0.3, 0.2])
    expect(result).toBeLessThan(0)
  })

  it("returns near-zero for stable FE", () => {
    const result = computeTrend([0.5, 0.5, 0.5, 0.5])
    expect(result).toBeCloseTo(0, 1)
  })
})

describe("findDominantChannel", () => {
  it("returns interoceptive as default for empty channels", () => {
    expect(findDominantChannel([])).toBe("interoceptive")
  })

  it("finds the channel with highest weighted error", () => {
    const channels = [
      makeChannel("interoceptive", 0.2, 0.5),
      makeChannel("anticipatory", 0.8, 0.9),
      makeChannel("coherence", 0.3, 0.7)
    ]
    expect(findDominantChannel(channels)).toBe("anticipatory")
  })
})
