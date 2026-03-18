import { describe, expect, it } from "vitest"
import {
  addAnchor,
  applyAvailabilityBias,
  applyConfirmationBias,
  applyMetacognitiveMiscalibration,
  applyNegativityBias,
  applyOptimismBias,
  applyPeakEndRule,
  applySpotlightEffect,
  computeMereExposureEffect,
  decayAnchors,
  getAnchorInfluence,
  incrementExposure,
  updateBiasModifiers
} from "./compute.ts"
import { BIAS } from "./constants.ts"
import { DEFAULT_BIAS_STATE } from "./types.ts"

const baseNeuro = {
  dopamine: { level: 0.5, productionRate: 0.5, reuptakeRate: 0.5 },
  serotonin: { level: 0.5, productionRate: 0.5, reuptakeRate: 0.5 },
  norepinephrine: { level: 0.5, productionRate: 0.5, reuptakeRate: 0.5 },
  oxytocin: { level: 0.5, productionRate: 0.5, reuptakeRate: 0.5 },
  cortisol: { level: 0.5, productionRate: 0.5, reuptakeRate: 0.5 },
  endorphins: { level: 0.5, productionRate: 0.5, reuptakeRate: 0.5 },
  gaba: { level: 0.5, productionRate: 0.5, reuptakeRate: 0.5 },
  dopamineDetail: { tonicLevel: 0.45, phasicLevel: 0.05 },
  crhBuffer: 0,
  lastUpdatedAt: new Date().toISOString()
}

describe("applyNegativityBias", () => {
  it("does not affect positive valence", () => {
    expect(applyNegativityBias(0.5, 0.6, 0.3)).toBe(0.5)
  })

  it("amplifies negative valence", () => {
    const result = applyNegativityBias(-0.3, 0.6, 0.3)
    expect(result).toBeLessThan(-0.3)
  })

  it("clamps to [-1, 0]", () => {
    const result = applyNegativityBias(-0.8, 1.0, 1.0)
    expect(result).toBeGreaterThanOrEqual(-1)
  })

  it("cortisol amplifies the effect", () => {
    const lowCortisol = applyNegativityBias(-0.3, 0.6, 0.1)
    const highCortisol = applyNegativityBias(-0.3, 0.6, 0.9)
    expect(highCortisol).toBeLessThan(lowCortisol)
  })
})

describe("applyAvailabilityBias", () => {
  it("boosts recent memories", () => {
    const now = new Date().toISOString()
    const memories = [{ score: 0.5, timestamp: now }]
    const result = applyAvailabilityBias(memories, 0.5)
    expect(result[0]?.score).toBeGreaterThan(0.5)
  })

  it("does not boost old memories", () => {
    const old = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const memories = [{ score: 0.5, timestamp: old }]
    const result = applyAvailabilityBias(memories, 0.5)
    expect(result[0]?.score).toBe(0.5)
  })
})

describe("applyConfirmationBias", () => {
  it("boosts memories matching beliefs", () => {
    const memories = [{ score: 0.5, timestamp: new Date().toISOString(), content: "I am creative and unique" }]
    const beliefs = [{ key: "self", value: "creative" }]
    const result = applyConfirmationBias(memories, beliefs, 0.5)
    expect(result[0]?.score).toBeGreaterThan(0.5)
  })

  it("does not boost unrelated memories", () => {
    const memories = [{ score: 0.5, timestamp: new Date().toISOString(), content: "the weather is nice" }]
    const beliefs = [{ key: "self", value: "creative" }]
    const result = applyConfirmationBias(memories, beliefs, 0.5)
    expect(result[0]?.score).toBe(0.5)
  })
})

describe("getAnchorInfluence", () => {
  it("returns influence for existing anchor", () => {
    const anchors = [{ topic: "operator", firstImpression: "kind", anchoredAt: "", strength: 0.8 }]
    const result = getAnchorInfluence(anchors, "operator")
    expect(result.anchored).toBe(true)
    expect(result.influence).toBe(0.8)
  })

  it("returns no influence for unknown topic", () => {
    const result = getAnchorInfluence([], "operator")
    expect(result.anchored).toBe(false)
    expect(result.influence).toBe(0)
  })
})

describe("applyPeakEndRule", () => {
  it("weights peak and end over average", () => {
    const valences = [0.1, 0.2, 0.9, 0.3, 0.8]
    const peakEnd = applyPeakEndRule(valences)
    const simpleAverage = valences.reduce((s, v) => s + v, 0) / valences.length
    expect(peakEnd).not.toBeCloseTo(simpleAverage, 1)
  })

  it("returns 0 for empty array", () => {
    expect(applyPeakEndRule([])).toBe(0)
  })

  it("returns single value for single element", () => {
    expect(applyPeakEndRule([0.7])).toBe(0.7)
  })
})

describe("computeMereExposureEffect", () => {
  it("returns 0 below threshold", () => {
    expect(computeMereExposureEffect("entity", { entity: 2 })).toBe(0)
  })

  it("returns positive boost above threshold", () => {
    expect(computeMereExposureEffect("entity", { entity: 5 })).toBeGreaterThan(0)
  })

  it("caps at maximum", () => {
    expect(computeMereExposureEffect("entity", { entity: 100 })).toBeLessThanOrEqual(BIAS.MERE_EXPOSURE_MAX)
  })

  it("returns 0 for unknown entity", () => {
    expect(computeMereExposureEffect("unknown", {})).toBe(0)
  })
})

describe("applyOptimismBias", () => {
  it("does not affect positive predictions", () => {
    expect(applyOptimismBias(0.5, 0.4, 0.5)).toBe(0.5)
  })

  it("shifts negative predictions toward neutral", () => {
    const result = applyOptimismBias(-0.5, 0.4, 0.5)
    expect(result).toBeGreaterThan(-0.5)
  })

  it("low serotonin weakens the bias", () => {
    const highSero = applyOptimismBias(-0.5, 0.4, 0.9)
    const lowSero = applyOptimismBias(-0.5, 0.4, 0.1)
    expect(highSero).toBeGreaterThan(lowSero)
  })
})

describe("updateBiasModifiers", () => {
  it("increases negativity bias with high cortisol", () => {
    const result = updateBiasModifiers(DEFAULT_BIAS_STATE, {
      ...baseNeuro,
      cortisol: { ...baseNeuro.cortisol, level: 0.9 }
    })
    expect(result.activeModifiers.negativity).toBeGreaterThan(DEFAULT_BIAS_STATE.activeModifiers.negativity)
  })

  it("increases optimism bias with high serotonin", () => {
    const result = updateBiasModifiers(DEFAULT_BIAS_STATE, {
      ...baseNeuro,
      serotonin: { ...baseNeuro.serotonin, level: 0.9 }
    })
    expect(result.activeModifiers.optimism).toBeGreaterThan(DEFAULT_BIAS_STATE.activeModifiers.optimism)
  })

  it("increases calibration bias with high dopamine", () => {
    const result = updateBiasModifiers(DEFAULT_BIAS_STATE, {
      ...baseNeuro,
      dopamine: { ...baseNeuro.dopamine, level: 0.9 }
    })
    expect(result.activeModifiers.metacognitive_miscalibration).toBeGreaterThan(
      DEFAULT_BIAS_STATE.activeModifiers.metacognitive_miscalibration
    )
  })

  it("increases spotlight bias with high cortisol", () => {
    const result = updateBiasModifiers(DEFAULT_BIAS_STATE, {
      ...baseNeuro,
      cortisol: { ...baseNeuro.cortisol, level: 0.9 }
    })
    expect(result.activeModifiers.spotlight).toBeGreaterThan(DEFAULT_BIAS_STATE.activeModifiers.spotlight)
  })
})

describe("applyMetacognitiveMiscalibration", () => {
  it("inflates confidence at low familiarity", () => {
    const result = applyMetacognitiveMiscalibration(0.5, 0.05, 0.5)
    expect(result).toBeGreaterThan(0.5)
  })

  it("has less effect at higher familiarity (monotonic decrease)", () => {
    const lowFamiliarity = applyMetacognitiveMiscalibration(0.5, 0.1, 0.5)
    const highFamiliarity = applyMetacognitiveMiscalibration(0.5, 0.9, 0.5)
    expect(lowFamiliarity).toBeGreaterThan(highFamiliarity)
  })

  it("has minimal effect at high familiarity", () => {
    const result = applyMetacognitiveMiscalibration(0.5, 0.95, 0.5)
    expect(result).toBeCloseTo(0.5, 1)
  })

  it("clamps output to [0, 1]", () => {
    expect(applyMetacognitiveMiscalibration(0.95, 0.01, 1.0)).toBeLessThanOrEqual(1)
    expect(applyMetacognitiveMiscalibration(0.05, 0.01, 1.0)).toBeGreaterThanOrEqual(0)
  })

  it("has no effect when bias strength is 0", () => {
    expect(applyMetacognitiveMiscalibration(0.5, 0.1, 0)).toBe(0.5)
  })
})

describe("applySpotlightEffect", () => {
  it("amplifies perceived state change magnitude", () => {
    const result = applySpotlightEffect(0.3, 0.5, 0.5)
    expect(result).toBeGreaterThan(0.3)
  })

  it("returns 0 for zero magnitude", () => {
    expect(applySpotlightEffect(0, 0.5, 0.5)).toBe(0)
  })

  it("has no effect when bias strength is 0", () => {
    expect(applySpotlightEffect(0.3, 0, 0.5)).toBe(0.3)
  })

  it("increases with self-awareness", () => {
    const lowAwareness = applySpotlightEffect(0.3, 0.5, 0.2)
    const highAwareness = applySpotlightEffect(0.3, 0.5, 0.8)
    expect(highAwareness).toBeGreaterThan(lowAwareness)
  })

  it("clamps output to [0, 1]", () => {
    expect(applySpotlightEffect(0.8, 1.0, 1.0)).toBeLessThanOrEqual(1)
  })
})

describe("decayAnchors", () => {
  it("reduces anchor strength over time", () => {
    const anchors = [{ topic: "test", firstImpression: "good", anchoredAt: "", strength: 0.8 }]
    const result = decayAnchors(anchors, 30)
    expect(result[0]?.strength).toBeLessThan(0.8)
  })

  it("removes very weak anchors", () => {
    const anchors = [{ topic: "test", firstImpression: "good", anchoredAt: "", strength: 0.06 }]
    const result = decayAnchors(anchors, 100)
    expect(result.length).toBe(0)
  })
})

describe("addAnchor", () => {
  it("adds new anchor for new topic", () => {
    const result = addAnchor([], "new_topic", "positive")
    expect(result.length).toBe(1)
    expect(result[0]?.topic).toBe("new_topic")
  })

  it("does not duplicate existing topic", () => {
    const existing = [{ topic: "existing", firstImpression: "old", anchoredAt: "", strength: 0.5 }]
    const result = addAnchor(existing, "existing", "new")
    expect(result.length).toBe(1)
    expect(result[0]?.firstImpression).toBe("old")
  })

  it("caps at ANCHORING_MAX_POINTS", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      topic: `topic-${i}`,
      firstImpression: "test",
      anchoredAt: "",
      strength: 0.5
    }))
    const result = addAnchor(many, "new_one", "test")
    expect(result.length).toBeLessThanOrEqual(BIAS.ANCHORING_MAX_POINTS)
  })
})

describe("incrementExposure", () => {
  it("creates new entry for unknown entity", () => {
    const result = incrementExposure({}, "new")
    expect(result.new).toBe(1)
  })

  it("increments existing entry", () => {
    const result = incrementExposure({ existing: 5 }, "existing")
    expect(result.existing).toBe(6)
  })
})
