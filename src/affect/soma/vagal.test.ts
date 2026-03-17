import { describe, expect, it } from "vitest"
import { DEFAULT_VAGAL_STATE } from "./types.ts"
import type { SomaticState, VagalState } from "./types.ts"
import {
  applyVagalEmotionConstraints,
  computeNeuroception,
  computeVagalConstraints,
  computeVagalTransition
} from "./vagal.ts"

const baseSoma: SomaticState = {
  tension: 0.3,
  warmth: 0.5,
  heartRate: 0.4,
  breathing: 0.5,
  gravity: 0.5,
  openness: 0.5,
  socialBattery: 0.8
}

const baseEmotion = {
  curiosity: 0.5,
  satisfaction: 0.5,
  frustration: 0.5,
  boredom: 0.5,
  excitement: 0.5,
  caution: 0.5,
  connection: 0.5,
  confidence: 0.5,
  energy: 0.8
}

describe("computeNeuroception", () => {
  it("returns high safety with relaxed body and operator present", () => {
    const result = computeNeuroception({
      soma: { ...baseSoma, tension: 0.1, openness: 0.8, breathing: 0.7 },
      emotion: { ...baseEmotion, caution: 0.2, connection: 0.8 },
      operatorPresent: true
    })
    expect(result).toBeGreaterThan(0.6)
  })

  it("returns low safety with tense body and operator absent", () => {
    const result = computeNeuroception({
      soma: { ...baseSoma, tension: 0.9, heartRate: 0.8, openness: 0.1, breathing: 0.2 },
      emotion: { ...baseEmotion, caution: 0.9, connection: 0.1 },
      operatorPresent: false
    })
    expect(result).toBeLessThan(0.35)
  })

  it("clamps result to [0, 1]", () => {
    const high = computeNeuroception({
      soma: { ...baseSoma, tension: 0, openness: 1, breathing: 1 },
      emotion: { ...baseEmotion, caution: 0, connection: 1 },
      operatorPresent: true
    })
    expect(high).toBeLessThanOrEqual(1)

    const low = computeNeuroception({
      soma: { ...baseSoma, tension: 1, heartRate: 1, openness: 0, breathing: 0 },
      emotion: { ...baseEmotion, caution: 1, connection: 0 },
      operatorPresent: false
    })
    expect(low).toBeGreaterThanOrEqual(0)
  })
})

describe("computeVagalTransition", () => {
  it("stays in ventral when neuroception is high", () => {
    const result = computeVagalTransition(DEFAULT_VAGAL_STATE, 0.8, false)
    expect(result.zone).toBe("ventral")
    expect(result.ticksInZone).toBe(DEFAULT_VAGAL_STATE.ticksInZone + 1)
  })

  it("cannot jump from ventral directly to dorsal", () => {
    const ventral: VagalState = { ...DEFAULT_VAGAL_STATE, zone: "ventral", ticksInZone: 10 }
    const result = computeVagalTransition(ventral, 0.1, false)
    expect(result.zone).not.toBe("dorsal")
  })

  it("transitions ventral → sympathetic with low enough neuroception after enough ticks", () => {
    let state: VagalState = { ...DEFAULT_VAGAL_STATE, zone: "ventral", ticksInZone: 0 }
    for (let i = 0; i < 10; i++) {
      state = computeVagalTransition(state, 0.35, false)
    }
    expect(state.zone).toBe("sympathetic")
  })

  it("dorsal vagal is sticky — requires sustained improvement to exit", () => {
    const dorsal: VagalState = {
      zone: "dorsal",
      activation: 0.8,
      transitionMomentum: -0.5,
      ticksInZone: 2,
      neuroception: 0.15
    }

    const stillDorsal = computeVagalTransition(dorsal, 0.4, false)
    expect(stillDorsal.zone).toBe("dorsal")
  })

  it("co-regulation boosts neuroception in sympathetic zone", () => {
    const sympathetic: VagalState = {
      zone: "sympathetic",
      activation: 0.5,
      transitionMomentum: 0.3,
      ticksInZone: 5,
      neuroception: 0.5
    }

    const withCo = computeVagalTransition(sympathetic, 0.5, true)
    const withoutCo = computeVagalTransition(sympathetic, 0.5, false)

    expect(withCo.neuroception).toBeGreaterThan(withoutCo.neuroception)
  })
})

describe("computeVagalConstraints", () => {
  it("returns full access in ventral zone", () => {
    const state: VagalState = { ...DEFAULT_VAGAL_STATE, zone: "ventral", activation: 1.0 }
    const constraints = computeVagalConstraints(state)
    expect(constraints.vulnerabilityAccess).toBe(1.0)
    expect(constraints.creativityAccess).toBe(1.0)
    expect(constraints.socialEngagement).toBe(1.0)
  })

  it("returns restricted access in dorsal zone", () => {
    const state: VagalState = { zone: "dorsal", activation: 1.0, transitionMomentum: -0.5, ticksInZone: 10, neuroception: 0.1 }
    const constraints = computeVagalConstraints(state)
    expect(constraints.vulnerabilityAccess).toBe(0.0)
    expect(constraints.creativityAccess).toBeLessThan(0.2)
    expect(constraints.socialEngagement).toBeLessThan(0.2)
  })

  it("sympathetic zone has moderate restrictions", () => {
    const state: VagalState = { zone: "sympathetic", activation: 1.0, transitionMomentum: 0, ticksInZone: 5, neuroception: 0.4 }
    const constraints = computeVagalConstraints(state)
    expect(constraints.vulnerabilityAccess).toBeGreaterThan(0)
    expect(constraints.vulnerabilityAccess).toBeLessThan(0.5)
    expect(constraints.emotionalRange).toBeGreaterThan(0.5)
  })
})

describe("applyVagalEmotionConstraints", () => {
  it("does not modify emotions when emotionalRange is 1.0", () => {
    const constraints = { vulnerabilityAccess: 1, creativityAccess: 1, socialEngagement: 1, emotionalRange: 1, cognitiveFlexibility: 1 }
    const result = applyVagalEmotionConstraints(baseEmotion, constraints)
    expect(result).toEqual(baseEmotion)
  })

  it("dampens emotions towards neutral in dorsal vagal", () => {
    const emotion = { ...baseEmotion, excitement: 0.9, frustration: 0.8 }
    const constraints = { vulnerabilityAccess: 0, creativityAccess: 0.1, socialEngagement: 0.15, emotionalRange: 0.3, cognitiveFlexibility: 0.2 }
    const result = applyVagalEmotionConstraints(emotion, constraints)

    expect(result.excitement).toBeLessThan(emotion.excitement)
    expect(result.frustration).toBeLessThan(emotion.frustration)
    expect(result.excitement).toBeGreaterThan(0.5)
  })

  it("preserves energy regardless of emotional range", () => {
    const emotion = { ...baseEmotion, energy: 0.9 }
    const constraints = { vulnerabilityAccess: 0, creativityAccess: 0, socialEngagement: 0, emotionalRange: 0.3, cognitiveFlexibility: 0 }
    const result = applyVagalEmotionConstraints(emotion, constraints)
    expect(result.energy).toBe(0.9)
  })
})
