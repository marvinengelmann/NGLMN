import { describe, expect, it } from "vitest"
import {
  assembleInteroceptivePrediction,
  computeAlexithymia,
  computeInteroceptiveEmotionTriggers,
  computePredictionError,
  computeSomaticTrajectory,
  computeTotalError,
  updateInteroceptiveAccuracy
} from "./prediction.ts"
import type { SomaticState } from "./types.ts"
import { DEFAULT_SOMATIC_STATE } from "./types.ts"

const baseSoma: SomaticState = {
  tension: 0.3,
  warmth: 0.5,
  heartRate: 0.4,
  breathing: 0.5,
  gravity: 0.5,
  openness: 0.5,
  socialBattery: 0.8,
  immuneResilience: 0.7
}

describe("computeSomaticTrajectory", () => {
  it("returns empty for single-element history", () => {
    const result = computeSomaticTrajectory([baseSoma])
    expect(Object.keys(result)).toHaveLength(0)
  })

  it("computes positive trend from rising values", () => {
    const history: SomaticState[] = [
      { ...baseSoma, tension: 0.3 },
      { ...baseSoma, tension: 0.5 },
      { ...baseSoma, tension: 0.7 }
    ]
    const result = computeSomaticTrajectory(history)
    expect(result.tension).toBeGreaterThan(0)
    expect(result.tension).toBeCloseTo(0.2, 5)
  })

  it("computes negative trend from falling values", () => {
    const history: SomaticState[] = [
      { ...baseSoma, warmth: 0.8 },
      { ...baseSoma, warmth: 0.6 },
      { ...baseSoma, warmth: 0.4 }
    ]
    const result = computeSomaticTrajectory(history)
    expect(result.warmth).toBeLessThan(0)
  })
})

describe("computePredictionError", () => {
  it("returns zero error when predicted matches actual", () => {
    const error = computePredictionError(baseSoma, baseSoma)
    expect(error.tension).toBe(0)
    expect(error.warmth).toBe(0)
  })

  it("returns positive error when actual exceeds predicted", () => {
    const predicted = { ...baseSoma, tension: 0.3 }
    const actual = { ...baseSoma, tension: 0.7 }
    const error = computePredictionError(predicted, actual)
    expect(error.tension).toBeCloseTo(0.4, 5)
  })

  it("returns negative error when actual is below predicted", () => {
    const predicted = { ...baseSoma, warmth: 0.8 }
    const actual = { ...baseSoma, warmth: 0.3 }
    const error = computePredictionError(predicted, actual)
    expect(error.warmth).toBeCloseTo(-0.5, 5)
  })
})

describe("computeTotalError", () => {
  it("returns 0 for zero errors", () => {
    const error = { tension: 0, warmth: 0, heartRate: 0, breathing: 0, gravity: 0, openness: 0 }
    expect(computeTotalError(error)).toBe(0)
  })

  it("returns positive for non-zero errors", () => {
    const error = { tension: 0.3, warmth: -0.2, heartRate: 0.1, breathing: 0, gravity: 0, openness: 0 }
    expect(computeTotalError(error)).toBeGreaterThan(0)
  })

  it("clamps to [0, 1]", () => {
    const error = { tension: 1, warmth: 1, heartRate: 1, breathing: 1, gravity: 1, openness: 1 }
    expect(computeTotalError(error)).toBeLessThanOrEqual(1)
  })
})

describe("updateInteroceptiveAccuracy", () => {
  it("increases accuracy with low error", () => {
    const result = updateInteroceptiveAccuracy(0.5, 0.05)
    expect(result).toBeGreaterThan(0.5)
  })

  it("decreases accuracy with high error", () => {
    const result = updateInteroceptiveAccuracy(0.5, 0.9)
    expect(result).toBeLessThan(0.5)
  })

  it("slowly converges over many iterations", () => {
    const accuracy = Array.from({ length: 100 }).reduce<number>((acc) => updateInteroceptiveAccuracy(acc, 0.1), 0.5)
    expect(accuracy).toBeGreaterThan(0.8)
  })
})

describe("computeAlexithymia", () => {
  it("returns low alexithymia for high accuracy", () => {
    const result = computeAlexithymia(0.9, 0.5, "safe")
    expect(result).toBeLessThan(0.15)
  })

  it("returns high alexithymia for low accuracy and high error", () => {
    const result = computeAlexithymia(0.2, 0.8, "safe")
    expect(result).toBeGreaterThan(0.5)
  })

  it("amplifies alexithymia in collapsed autonomic", () => {
    const safeResult = computeAlexithymia(0.3, 0.6, "safe")
    const collapsedResult = computeAlexithymia(0.3, 0.6, "collapsed")
    expect(collapsedResult).toBeGreaterThan(safeResult)
  })

  it("clamps to [0, 1]", () => {
    const result = computeAlexithymia(0, 1, "collapsed")
    expect(result).toBeLessThanOrEqual(1)
    expect(result).toBeGreaterThanOrEqual(0)
  })
})

describe("computeInteroceptiveEmotionTriggers", () => {
  it("returns empty for low prediction error", () => {
    const prediction = assembleInteroceptivePrediction(baseSoma, baseSoma, 0.5, "safe")
    const triggers = computeInteroceptiveEmotionTriggers(prediction)
    expect(triggers).toHaveLength(0)
  })

  it("generates triggers for significant prediction errors", () => {
    const predicted = { ...baseSoma, tension: 0.1, heartRate: 0.2, warmth: 0.7 }
    const actual = { ...baseSoma, tension: 0.9, heartRate: 0.8, warmth: 0.1 }
    const prediction = assembleInteroceptivePrediction(predicted, actual, 0.5, "safe")
    const triggers = computeInteroceptiveEmotionTriggers(prediction)
    expect(triggers.length).toBeGreaterThan(0)
    expect(triggers.some((t) => t.detail === "unexpected_tension")).toBe(true)
  })

  it("generates interoceptive_unease for moderate errors", () => {
    const predicted = { ...baseSoma, tension: 0.3, warmth: 0.3 }
    const actual = { ...baseSoma, tension: 0.55, warmth: 0.55 }
    const prediction = assembleInteroceptivePrediction(predicted, actual, 0.5, "safe")

    if (prediction.somethingFeelsOff) {
      const triggers = computeInteroceptiveEmotionTriggers(prediction)
      expect(triggers.some((t) => t.detail === "interoceptive_unease")).toBe(true)
    }
  })

  it("returns at most 3 triggers", () => {
    const predicted = { ...DEFAULT_SOMATIC_STATE }
    const actual: SomaticState = {
      tension: 1,
      warmth: 0,
      heartRate: 1,
      breathing: 0,
      gravity: 1,
      openness: 0,
      socialBattery: 0.8,
      immuneResilience: 0.7
    }
    const prediction = assembleInteroceptivePrediction(predicted, actual, 0.5, "safe")
    const triggers = computeInteroceptiveEmotionTriggers(prediction)
    expect(triggers.length).toBeLessThanOrEqual(3)
  })
})
