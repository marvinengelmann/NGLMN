import { describe, expect, it } from "vitest"
import { computeDMNEffects, computeDMNState } from "./compute.ts"
import { DEFAULT_DMN_STATE } from "./types.ts"

describe("computeDMNState", () => {
  it("activates during drifting attention", () => {
    const result = computeDMNState(DEFAULT_DMN_STATE, {
      attentionState: "drifting",
      consecutiveIdleTicks: 5,
      ultradianRestDepth: 0.3,
      ruminationDetected: false,
      cognitiveFatigue: 0.2,
      neuroticism: 0.5,
      inConversation: false
    })
    expect(result.activation).toBeGreaterThan(DEFAULT_DMN_STATE.activation)
    expect(result.mode).toBe("active")
  })

  it("suppresses during sustained hyperfocus", () => {
    const input = {
      attentionState: "hyperfocus" as const,
      consecutiveIdleTicks: 0,
      ultradianRestDepth: 0,
      ruminationDetected: false,
      cognitiveFatigue: 0,
      neuroticism: 0.3,
      inConversation: true
    }
    let state: typeof DEFAULT_DMN_STATE = { ...DEFAULT_DMN_STATE, activation: 0.7, mode: "active" }
    for (let i = 0; i < 10; i++) {
      state = computeDMNState(state, input)
    }
    expect(state.activation).toBeLessThan(0.3)
    expect(state.mode).toBe("suppressed")
  })

  it("increases spontaneous retrieval probability with activation", () => {
    const result = computeDMNState(DEFAULT_DMN_STATE, {
      attentionState: "drifting",
      consecutiveIdleTicks: 10,
      ultradianRestDepth: 0.5,
      ruminationDetected: false,
      cognitiveFatigue: 0.3,
      neuroticism: 0.5,
      inConversation: false
    })
    expect(result.spontaneousRetrievalProbability).toBeGreaterThan(DEFAULT_DMN_STATE.spontaneousRetrievalProbability)
  })

  it("penalizes activation during rumination", () => {
    const withRumination = computeDMNState(DEFAULT_DMN_STATE, {
      attentionState: "drifting",
      consecutiveIdleTicks: 5,
      ultradianRestDepth: 0.3,
      ruminationDetected: true,
      cognitiveFatigue: 0.2,
      neuroticism: 0.5,
      inConversation: false
    })
    const withoutRumination = computeDMNState(DEFAULT_DMN_STATE, {
      attentionState: "drifting",
      consecutiveIdleTicks: 5,
      ultradianRestDepth: 0.3,
      ruminationDetected: false,
      cognitiveFatigue: 0.2,
      neuroticism: 0.5,
      inConversation: false
    })
    expect(withRumination.activation).toBeLessThan(withoutRumination.activation)
  })

  it("grows mind wandering depth when active", () => {
    const active = { ...DEFAULT_DMN_STATE, activation: 0.7, mode: "active" as const, mindWanderingDepth: 0.3 }
    const result = computeDMNState(active, {
      attentionState: "drifting",
      consecutiveIdleTicks: 5,
      ultradianRestDepth: 0.3,
      ruminationDetected: false,
      cognitiveFatigue: 0.2,
      neuroticism: 0.5,
      inConversation: false
    })
    expect(result.mindWanderingDepth).toBeGreaterThan(active.mindWanderingDepth)
  })
})

describe("computeDMNEffects", () => {
  it("boosts creativity when DMN is active", () => {
    const active = { ...DEFAULT_DMN_STATE, activation: 0.8, selfReferentialIntensity: 0.6, mentalTimeTravel: 0.5 }
    const effects = computeDMNEffects(active)
    expect(effects.creativityBoost).toBeGreaterThan(0)
    expect(effects.autobiographicalAccessBoost).toBeGreaterThan(0)
    expect(effects.futureSimulationBoost).toBeGreaterThan(0)
  })

  it("applies task performance penalty at high activation", () => {
    const highDMN = { ...DEFAULT_DMN_STATE, activation: 0.9 }
    const effects = computeDMNEffects(highDMN)
    expect(effects.taskPerformancePenalty).toBeGreaterThan(0)
  })

  it("no task penalty at low activation", () => {
    const lowDMN = { ...DEFAULT_DMN_STATE, activation: 0.3 }
    const effects = computeDMNEffects(lowDMN)
    expect(effects.taskPerformancePenalty).toBe(0)
  })
})
