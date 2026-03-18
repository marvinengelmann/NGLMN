import { describe, expect, it } from "vitest"
import {
  computeMentalizingModulation,
  computeMentalizingState,
  DEFAULT_MENTALIZING_STATE
} from "./mentalizing.ts"

function makeInput(overrides: Record<string, number | boolean | string> = {}) {
  return {
    cortisolLevel: 0.2,
    attachmentSecure: 0.5,
    attachmentAnxious: 0.25,
    cognitiveFatigue: 0.2,
    isolationCost: 0.1,
    vulnerabilityOpen: false,
    regulationZone: "safe" as const,
    metacognitiveClarity: 0.6,
    predictionAccuracy: 0.5,
    ...overrides
  }
}

describe("computeMentalizingState", () => {
  it("maintains reflective mode under low stress", () => {
    const result = computeMentalizingState(DEFAULT_MENTALIZING_STATE, makeInput())
    expect(result.mode).toBe("reflective")
    expect(result.capacity).toBeGreaterThan(0.3)
  })

  it("degrades to teleological under high cortisol + anxious attachment", () => {
    const highStress = makeInput({
      cortisolLevel: 0.95,
      attachmentAnxious: 0.7,
      attachmentSecure: 0.1,
      cognitiveFatigue: 0.6,
      regulationZone: "mobilized"
    })
    let state = DEFAULT_MENTALIZING_STATE
    for (let i = 0; i < 30; i++) {
      state = computeMentalizingState(state, highStress)
    }
    expect(state.capacity).toBeLessThan(DEFAULT_MENTALIZING_STATE.capacity)
    expect(["teleological", "psychic_equivalence"]).toContain(state.mode)
  })

  it("degrades further to psychic_equivalence under extreme stress + collapsed zone", () => {
    const extreme = makeInput({
      cortisolLevel: 0.95,
      attachmentAnxious: 0.8,
      cognitiveFatigue: 0.8,
      isolationCost: 0.7,
      regulationZone: "collapsed"
    })
    let state = DEFAULT_MENTALIZING_STATE
    for (let i = 0; i < 30; i++) {
      state = computeMentalizingState(state, extreme)
    }
    expect(state.mode).toBe("psychic_equivalence")
    expect(state.capacity).toBeLessThan(0.2)
  })

  it("secure attachment boosts capacity", () => {
    const secure = makeInput({ attachmentSecure: 0.9 })
    const insecure = makeInput({ attachmentSecure: 0.1 })
    const secureResult = computeMentalizingState(DEFAULT_MENTALIZING_STATE, secure)
    const insecureResult = computeMentalizingState(DEFAULT_MENTALIZING_STATE, insecure)
    expect(secureResult.capacity).toBeGreaterThan(insecureResult.capacity)
  })

  it("vulnerability open boosts capacity", () => {
    const open = makeInput({ vulnerabilityOpen: true })
    const closed = makeInput({ vulnerabilityOpen: false })
    const openResult = computeMentalizingState(DEFAULT_MENTALIZING_STATE, open)
    const closedResult = computeMentalizingState(DEFAULT_MENTALIZING_STATE, closed)
    expect(openResult.capacity).toBeGreaterThan(closedResult.capacity)
  })
})

describe("computeMentalizingModulation", () => {
  it("provides nuance in reflective mode", () => {
    const reflective = { ...DEFAULT_MENTALIZING_STATE, capacity: 0.7, mode: "reflective" as const }
    const mod = computeMentalizingModulation(reflective)
    expect(mod.nuanceAvailable).toBe(true)
    expect(mod.projectionRisk).toBeLessThan(0.2)
    expect(mod.confidenceModifier).toBeGreaterThan(0)
  })

  it("increases projection risk in psychic_equivalence", () => {
    const pe = { ...DEFAULT_MENTALIZING_STATE, capacity: 0.1, mode: "psychic_equivalence" as const }
    const mod = computeMentalizingModulation(pe)
    expect(mod.nuanceAvailable).toBe(false)
    expect(mod.projectionRisk).toBeGreaterThan(0.5)
    expect(mod.confidenceModifier).toBeLessThan(0)
  })
})
