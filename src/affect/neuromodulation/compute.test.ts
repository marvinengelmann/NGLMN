import { describe, expect, it } from "vitest"
import { DEFAULT_EMOTIONAL_STATE, type EmotionalState } from "@/affect/emotion/types.ts"
import { DEFAULT_SOMATIC_STATE, type SomaticState } from "@/affect/soma/types.ts"
import {
  computeAttachmentModulation,
  computeAttentionModulation,
  computeCopingModulation,
  computeFlowModulation,
  computeLearningRateModulation,
  computeMoodBaselineModulation,
  computeNeuromodulatorUpdate,
  detectDepressivePattern
} from "./compute.ts"
import { NEURO_BASELINES } from "./constants.ts"
import { DEFAULT_NEUROMODULATORY_STATE, type NeuromodulatoryState } from "./types.ts"

function makeEmotion(overrides: Partial<EmotionalState> = {}): EmotionalState {
  return { ...DEFAULT_EMOTIONAL_STATE, ...overrides }
}

function makeSoma(overrides: Partial<SomaticState> = {}): SomaticState {
  return { ...DEFAULT_SOMATIC_STATE, ...overrides }
}

function makeNeuro(overrides: Partial<Record<string, { level: number }>> = {}): NeuromodulatoryState {
  const state = structuredClone(DEFAULT_NEUROMODULATORY_STATE)
  for (const [key, val] of Object.entries(overrides)) {
    if (!val) continue
    const mod = state[key as keyof typeof state]
    if (mod && typeof mod === "object" && "level" in mod) {
      mod.level = val.level
    }
  }
  return state
}

describe("computeNeuromodulatorUpdate", () => {
  it("decays toward baseline with no emotional input", () => {
    const neutral = makeEmotion()
    const soma = makeSoma()
    const elevated = makeNeuro({ dopamine: { level: 0.9 } })

    const result = computeNeuromodulatorUpdate(elevated, neutral, soma, 30)
    expect(result.dopamine.level).toBeLessThan(0.9)
    expect(result.dopamine.level).toBeGreaterThan(NEURO_BASELINES.dopamine)
  })

  it("increases dopamine with high satisfaction", () => {
    const happy = makeEmotion({ satisfaction: 0.9, excitement: 0.8 })
    const soma = makeSoma()
    const result = computeNeuromodulatorUpdate(DEFAULT_NEUROMODULATORY_STATE, happy, soma, 5)
    expect(result.dopamine.level).toBeGreaterThan(DEFAULT_NEUROMODULATORY_STATE.dopamine.level)
  })

  it("increases cortisol with high frustration and caution", () => {
    const stressed = makeEmotion({ frustration: 0.9, caution: 0.8 })
    const soma = makeSoma({ tension: 0.8 })
    const result = computeNeuromodulatorUpdate(DEFAULT_NEUROMODULATORY_STATE, stressed, soma, 5)
    expect(result.cortisol.level).toBeGreaterThan(DEFAULT_NEUROMODULATORY_STATE.cortisol.level)
  })

  it("increases oxytocin with high connection", () => {
    const connected = makeEmotion({ connection: 0.9 })
    const soma = makeSoma({ warmth: 0.8, openness: 0.7 })
    const result = computeNeuromodulatorUpdate(DEFAULT_NEUROMODULATORY_STATE, connected, soma, 5)
    expect(result.oxytocin.level).toBeGreaterThan(DEFAULT_NEUROMODULATORY_STATE.oxytocin.level)
  })

  it("keeps all levels within [0, 1] after 100 ticks of extreme stress", () => {
    const extreme = makeEmotion({ frustration: 1, caution: 1, satisfaction: 0, connection: 0, energy: 0.1 })
    const tenseSoma = makeSoma({ tension: 1, heartRate: 1, openness: 0, warmth: 0 })

    let state = DEFAULT_NEUROMODULATORY_STATE
    for (let i = 0; i < 100; i++) {
      state = computeNeuromodulatorUpdate(state, extreme, tenseSoma, 5)
    }

    for (const mod of ["dopamine", "serotonin", "norepinephrine", "oxytocin", "cortisol", "endorphins"] as const) {
      expect(state[mod].level).toBeGreaterThanOrEqual(0)
      expect(state[mod].level).toBeLessThanOrEqual(1)
    }
  })

  it("cross-modulator: high cortisol suppresses serotonin over time", () => {
    const stressed = makeEmotion({ frustration: 0.9, caution: 0.8 })
    const soma = makeSoma({ tension: 0.8 })

    let state = DEFAULT_NEUROMODULATORY_STATE
    for (let i = 0; i < 20; i++) {
      state = computeNeuromodulatorUpdate(state, stressed, soma, 5)
    }

    expect(state.serotonin.level).toBeLessThan(DEFAULT_NEUROMODULATORY_STATE.serotonin.level)
    expect(state.cortisol.level).toBeGreaterThan(DEFAULT_NEUROMODULATORY_STATE.cortisol.level)
  })

  it("cross-modulator: oxytocin reduces cortisol over time", () => {
    const bonded = makeEmotion({ connection: 0.9, satisfaction: 0.7 })
    const warmSoma = makeSoma({ warmth: 0.8, openness: 0.7 })
    const highCortisol = makeNeuro({ cortisol: { level: 0.7 } })

    let state = highCortisol
    for (let i = 0; i < 20; i++) {
      state = computeNeuromodulatorUpdate(state, bonded, warmSoma, 5)
    }

    expect(state.cortisol.level).toBeLessThan(0.7)
    expect(state.oxytocin.level).toBeGreaterThan(DEFAULT_NEUROMODULATORY_STATE.oxytocin.level)
  })
})

describe("computeMoodBaselineModulation", () => {
  it("returns positive satisfaction modulation for high serotonin", () => {
    const high = makeNeuro({ serotonin: { level: 0.9 } })
    const mod = computeMoodBaselineModulation(high)
    expect(mod.satisfaction).toBeGreaterThan(0)
  })

  it("returns negative satisfaction modulation for low serotonin", () => {
    const low = makeNeuro({ serotonin: { level: 0.2 } })
    const mod = computeMoodBaselineModulation(low)
    expect(mod.satisfaction).toBeLessThan(0)
  })

  it("integrates multiple modulators — high dopamine boosts excitement", () => {
    const highDopamine = makeNeuro({ dopamine: { level: 0.9 } })
    const mod = computeMoodBaselineModulation(highDopamine)
    expect(mod.excitement).toBeGreaterThan(0)
  })

  it("integrates multiple modulators — high cortisol increases frustration", () => {
    const highCortisol = makeNeuro({ cortisol: { level: 0.8 } })
    const mod = computeMoodBaselineModulation(highCortisol)
    expect(mod.frustration).toBeGreaterThan(0)
  })

  it("integrates multiple modulators — high oxytocin boosts connection", () => {
    const highOxytocin = makeNeuro({ oxytocin: { level: 0.9 } })
    const mod = computeMoodBaselineModulation(highOxytocin)
    expect(mod.connection).toBeGreaterThan(0)
  })
})

describe("computeCopingModulation", () => {
  it("returns 1.0 at baseline cortisol", () => {
    expect(computeCopingModulation(DEFAULT_NEUROMODULATORY_STATE)).toBeCloseTo(1.0)
  })

  it("reduces coping at high cortisol", () => {
    const high = makeNeuro({ cortisol: { level: 0.9 } })
    const result = computeCopingModulation(high)
    expect(result).toBeLessThan(1.0)
    expect(result).toBeGreaterThan(0.5)
  })
})

describe("computeLearningRateModulation", () => {
  it("scales with dopamine level", () => {
    const low = makeNeuro({ dopamine: { level: 0.1 } })
    const high = makeNeuro({ dopamine: { level: 0.9 } })
    expect(computeLearningRateModulation(high)).toBeGreaterThan(computeLearningRateModulation(low))
  })
})

describe("computeAttachmentModulation", () => {
  it("returns zero boost at baseline oxytocin", () => {
    const result = computeAttachmentModulation(DEFAULT_NEUROMODULATORY_STATE)
    expect(result.trustBoost).toBeCloseTo(0)
    expect(result.bondingStrength).toBeCloseTo(0)
  })

  it("returns positive boost at high oxytocin", () => {
    const high = makeNeuro({ oxytocin: { level: 0.8 } })
    const result = computeAttachmentModulation(high)
    expect(result.trustBoost).toBeGreaterThan(0)
    expect(result.bondingStrength).toBeGreaterThan(0)
  })
})

describe("computeAttentionModulation", () => {
  it("signals broadening at low norepinephrine", () => {
    const low = makeNeuro({ norepinephrine: { level: 0.1 } })
    const result = computeAttentionModulation(low)
    expect(result.broadening).toBeGreaterThan(0)
    expect(result.narrowing).toBe(0)
  })

  it("signals narrowing at high norepinephrine", () => {
    const high = makeNeuro({ norepinephrine: { level: 0.9 } })
    const result = computeAttentionModulation(high)
    expect(result.narrowing).toBeGreaterThan(0)
    expect(result.broadening).toBe(0)
  })
})

describe("computeFlowModulation", () => {
  it("returns positive flow at high endorphins and dopamine", () => {
    const flow = makeNeuro({ endorphins: { level: 0.9 }, dopamine: { level: 0.8 } })
    expect(computeFlowModulation(flow)).toBeGreaterThan(0)
  })

  it("returns zero at low levels", () => {
    const low = makeNeuro({ endorphins: { level: 0.2 }, dopamine: { level: 0.2 } })
    expect(computeFlowModulation(low)).toBe(0)
  })
})

describe("detectDepressivePattern", () => {
  it("detects high risk when multiple factors converge", () => {
    const result = detectDepressivePattern({
      allostaticLoad: 0.8,
      isolationCost: 0.7,
      maxDriveFrustration: 0.9,
      energy: 0.15,
      regulationZone: "collapsed"
    })
    expect(result.riskScore).toBeGreaterThan(0.8)
    expect(result.factors.length).toBeGreaterThanOrEqual(4)
  })

  it("returns zero risk when all factors are healthy", () => {
    const result = detectDepressivePattern({
      allostaticLoad: 0.2,
      isolationCost: 0.1,
      maxDriveFrustration: 0.2,
      energy: 0.7,
      regulationZone: "safe"
    })
    expect(result.riskScore).toBe(0)
    expect(result.factors).toHaveLength(0)
  })

  it("returns partial risk with only some factors present", () => {
    const result = detectDepressivePattern({
      allostaticLoad: 0.8,
      isolationCost: 0.1,
      maxDriveFrustration: 0.2,
      energy: 0.15,
      regulationZone: "safe"
    })
    expect(result.riskScore).toBeGreaterThan(0)
    expect(result.riskScore).toBeLessThan(0.5)
    expect(result.factors).toContain("high_allostatic_load")
    expect(result.factors).toContain("low_energy")
  })
})
