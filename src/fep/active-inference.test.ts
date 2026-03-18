import { describe, expect, it } from "vitest"
import { computeActiveInferenceSignal, computeExplorationExploitationBalance } from "./active-inference.ts"
import {
  DEFAULT_FREE_ENERGY_STATE,
  DEFAULT_PRECISION_WEIGHTS,
  type FreeEnergyState,
  type PredictionErrorChannel
} from "./types.ts"

function makeChannel(
  name: PredictionErrorChannel["name"],
  rawError: number,
  precision: number
): PredictionErrorChannel {
  return { name, rawError, precision, weightedError: precision * rawError * rawError }
}

describe("computeActiveInferenceSignal", () => {
  it("prefers respond when anticipatory PE is dominant", () => {
    const feState: FreeEnergyState = {
      ...DEFAULT_FREE_ENERGY_STATE,
      channels: [
        makeChannel("interoceptive", 0.1, 0.5),
        makeChannel("anticipatory", 0.9, 0.9),
        makeChannel("novelty", 0.1, 0.5),
        makeChannel("relational", 0.1, 0.5),
        makeChannel("coherence", 0.1, 0.5),
        makeChannel("dissonance", 0.1, 0.5),
        makeChannel("drive", 0.1, 0.5),
        makeChannel("forecast", 0.1, 0.5),
        makeChannel("metacognitive", 0.1, 0.5)
      ]
    }
    const result = computeActiveInferenceSignal(feState)
    expect(result.preferredAction).toBe("respond")
  })

  it("prefers reflect when metacognitive PE is dominant", () => {
    const feState: FreeEnergyState = {
      ...DEFAULT_FREE_ENERGY_STATE,
      channels: [
        makeChannel("interoceptive", 0.1, 0.3),
        makeChannel("anticipatory", 0.1, 0.3),
        makeChannel("novelty", 0.1, 0.3),
        makeChannel("relational", 0.1, 0.3),
        makeChannel("coherence", 0.1, 0.3),
        makeChannel("dissonance", 0.1, 0.3),
        makeChannel("drive", 0.1, 0.3),
        makeChannel("forecast", 0.1, 0.3),
        makeChannel("metacognitive", 0.9, 0.9)
      ]
    }
    const result = computeActiveInferenceSignal(feState)
    expect(result.preferredAction).toBe("reflect")
  })

  it("returns null preferred action when all channels are zero", () => {
    const feState: FreeEnergyState = {
      ...DEFAULT_FREE_ENERGY_STATE,
      channels: [
        makeChannel("interoceptive", 0, 0.5),
        makeChannel("anticipatory", 0, 0.5),
        makeChannel("novelty", 0, 0.5),
        makeChannel("relational", 0, 0.5),
        makeChannel("coherence", 0, 0.5),
        makeChannel("dissonance", 0, 0.5),
        makeChannel("drive", 0, 0.5),
        makeChannel("forecast", 0, 0.5),
        makeChannel("metacognitive", 0, 0.5)
      ]
    }
    const result = computeActiveInferenceSignal(feState)
    expect(result.preferredAction).toBeNull()
  })
})

describe("computeExplorationExploitationBalance", () => {
  it("high precision → exploitation", () => {
    const highPrecision = { ...DEFAULT_PRECISION_WEIGHTS }
    for (const key of Object.keys(highPrecision) as (keyof typeof highPrecision)[]) {
      highPrecision[key] = 0.9
    }
    const result = computeExplorationExploitationBalance(highPrecision, 0.2, 0.3)
    expect(result.exploitationPull).toBeGreaterThan(result.explorationBonus)
  })

  it("low precision → exploration", () => {
    const lowPrecision = { ...DEFAULT_PRECISION_WEIGHTS }
    for (const key of Object.keys(lowPrecision) as (keyof typeof lowPrecision)[]) {
      lowPrecision[key] = 0.1
    }
    const result = computeExplorationExploitationBalance(lowPrecision, 0.2, 0.8)
    expect(result.explorationBonus).toBeGreaterThan(result.exploitationPull)
  })

  it("high allostatic load reduces exploitation", () => {
    const fresh = computeExplorationExploitationBalance(DEFAULT_PRECISION_WEIGHTS, 0, 0.3)
    const burned = computeExplorationExploitationBalance(DEFAULT_PRECISION_WEIGHTS, 0.9, 0.3)
    expect(fresh.exploitationPull).toBeGreaterThan(burned.exploitationPull)
  })
})
