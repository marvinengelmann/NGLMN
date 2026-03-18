import { describe, expect, it } from "vitest"
import type { NeuromodulatoryState } from "@/affect/neuromodulation/types.ts"
import { DEFAULT_NEUROMODULATORY_STATE } from "@/affect/neuromodulation/types.ts"
import { applyNeuromodulatorPrecisionEffects, computeBasePrecisionWeights } from "./precision.ts"
import { DEFAULT_PRECISION_WEIGHTS } from "./types.ts"

describe("computeBasePrecisionWeights", () => {
  it("produces higher interoceptive precision in safe zone", () => {
    const safe = computeBasePrecisionWeights({
      interoceptiveAccuracy: 0.8,
      regulationZone: "safe",
      patternConfidence: 0.5,
      metacognitiveClarity: 0.7,
      operatorModelConfidence: 0.5,
      coherenceIntegrationScore: 0.7,
      cognitiveFatigue: 0.2,
      forecastAccuracy: 0.5
    })
    const collapsed = computeBasePrecisionWeights({
      interoceptiveAccuracy: 0.8,
      regulationZone: "collapsed",
      patternConfidence: 0.5,
      metacognitiveClarity: 0.7,
      operatorModelConfidence: 0.5,
      coherenceIntegrationScore: 0.7,
      cognitiveFatigue: 0.2,
      forecastAccuracy: 0.5
    })
    expect(safe.interoceptive).toBeGreaterThan(collapsed.interoceptive)
  })

  it("drive precision decreases with cognitive fatigue", () => {
    const fresh = computeBasePrecisionWeights({
      interoceptiveAccuracy: 0.5,
      regulationZone: "safe",
      patternConfidence: 0.5,
      metacognitiveClarity: 0.5,
      operatorModelConfidence: 0.5,
      coherenceIntegrationScore: 0.5,
      cognitiveFatigue: 0,
      forecastAccuracy: 0.5
    })
    const fatigued = computeBasePrecisionWeights({
      interoceptiveAccuracy: 0.5,
      regulationZone: "safe",
      patternConfidence: 0.5,
      metacognitiveClarity: 0.5,
      operatorModelConfidence: 0.5,
      coherenceIntegrationScore: 0.5,
      cognitiveFatigue: 0.9,
      forecastAccuracy: 0.5
    })
    expect(fresh.drive).toBeGreaterThan(fatigued.drive)
  })

  it("all precisions are within [0, 1]", () => {
    const result = computeBasePrecisionWeights({
      interoceptiveAccuracy: 1,
      regulationZone: "safe",
      patternConfidence: 1,
      metacognitiveClarity: 1,
      operatorModelConfidence: 1,
      coherenceIntegrationScore: 1,
      cognitiveFatigue: 0,
      forecastAccuracy: 1
    })
    for (const value of Object.values(result)) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })
})

describe("applyNeuromodulatorPrecisionEffects", () => {
  it("high cortisol narrows to threat channels and dampens social", () => {
    const highCortisol: NeuromodulatoryState = {
      ...DEFAULT_NEUROMODULATORY_STATE,
      cortisol: { level: 0.9, productionRate: 0.5, reuptakeRate: 0.5 }
    }
    const base = { ...DEFAULT_PRECISION_WEIGHTS }
    const result = applyNeuromodulatorPrecisionEffects(base, highCortisol)

    expect(result.interoceptive).toBeGreaterThan(base.interoceptive * 0.8)
    expect(result.relational).toBeLessThan(base.relational)
  })

  it("high dopamine sharpens reward channels", () => {
    const highDopamine: NeuromodulatoryState = {
      ...DEFAULT_NEUROMODULATORY_STATE,
      dopamine: { level: 0.9, productionRate: 0.5, reuptakeRate: 0.5 }
    }
    const lowDopamine: NeuromodulatoryState = {
      ...DEFAULT_NEUROMODULATORY_STATE,
      dopamine: { level: 0.1, productionRate: 0.5, reuptakeRate: 0.5 }
    }
    const base = { ...DEFAULT_PRECISION_WEIGHTS }

    const high = applyNeuromodulatorPrecisionEffects(base, highDopamine)
    const low = applyNeuromodulatorPrecisionEffects(base, lowDopamine)

    expect(high.drive).toBeGreaterThan(low.drive)
    expect(high.anticipatory).toBeGreaterThan(low.anticipatory)
  })

  it("low serotonin reduces anticipatory and forecast precision (volatility channels)", () => {
    const lowSerotonin: NeuromodulatoryState = {
      ...DEFAULT_NEUROMODULATORY_STATE,
      serotonin: { level: 0.1, productionRate: 0.5, reuptakeRate: 0.5 }
    }
    const normalSerotonin: NeuromodulatoryState = {
      ...DEFAULT_NEUROMODULATORY_STATE,
      serotonin: { level: 0.6, productionRate: 0.5, reuptakeRate: 0.5 }
    }
    const base = { ...DEFAULT_PRECISION_WEIGHTS }

    const low = applyNeuromodulatorPrecisionEffects(base, lowSerotonin)
    const normal = applyNeuromodulatorPrecisionEffects(base, normalSerotonin)

    expect(low.anticipatory).toBeLessThan(normal.anticipatory)
    expect(low.forecast).toBeLessThan(normal.forecast)
  })

  it("high oxytocin boosts relational precision", () => {
    const highOxy: NeuromodulatoryState = {
      ...DEFAULT_NEUROMODULATORY_STATE,
      oxytocin: { level: 0.9, productionRate: 0.5, reuptakeRate: 0.5 }
    }
    const lowOxy: NeuromodulatoryState = {
      ...DEFAULT_NEUROMODULATORY_STATE,
      oxytocin: { level: 0.1, productionRate: 0.5, reuptakeRate: 0.5 }
    }
    const base = { ...DEFAULT_PRECISION_WEIGHTS }

    const high = applyNeuromodulatorPrecisionEffects(base, highOxy)
    const low = applyNeuromodulatorPrecisionEffects(base, lowOxy)

    expect(high.relational).toBeGreaterThan(low.relational)
  })

  it("all results stay within precision bounds", () => {
    const extremeNeuro: NeuromodulatoryState = {
      dopamine: { level: 1, productionRate: 1, reuptakeRate: 0 },
      serotonin: { level: 0, productionRate: 0, reuptakeRate: 1 },
      norepinephrine: { level: 1, productionRate: 1, reuptakeRate: 0 },
      oxytocin: { level: 1, productionRate: 1, reuptakeRate: 0 },
      cortisol: { level: 1, productionRate: 1, reuptakeRate: 0 },
      endorphins: { level: 1, productionRate: 1, reuptakeRate: 0 },
      gaba: { level: 0.5, productionRate: 0.5, reuptakeRate: 0.5 },
      dopamineDetail: { tonicLevel: 0.45, phasicLevel: 0.05 },
      crhBuffer: 0,
      lastUpdatedAt: new Date().toISOString()
    }
    const result = applyNeuromodulatorPrecisionEffects(DEFAULT_PRECISION_WEIGHTS, extremeNeuro)

    for (const value of Object.values(result)) {
      expect(value).toBeGreaterThanOrEqual(0.05)
      expect(value).toBeLessThanOrEqual(1)
    }
  })
})
