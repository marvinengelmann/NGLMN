import { describe, expect, it } from "vitest"
import {
  computeDefenseExpressionModifiers,
  computeRepressionEffect,
  type DefenseContext,
  decayDefenses,
  processDefenseCycle,
  selectActiveDefenses
} from "./compute.ts"
import { type ActiveDefense, DEFAULT_DEFENSE_STATE, type DefenseState } from "./types.ts"

const baseEmotion = {
  curiosity: 0.5,
  satisfaction: 0.4,
  frustration: 0.3,
  boredom: 0.2,
  excitement: 0.3,
  caution: 0.3,
  connection: 0.5,
  confidence: 0.5,
  energy: 0.6
}

const baseNeuro = {
  dopamine: { level: 0.5, productionRate: 0.5, reuptakeRate: 0.5 },
  serotonin: { level: 0.5, productionRate: 0.5, reuptakeRate: 0.5 },
  norepinephrine: { level: 0.5, productionRate: 0.5, reuptakeRate: 0.5 },
  oxytocin: { level: 0.5, productionRate: 0.5, reuptakeRate: 0.5 },
  cortisol: { level: 0.3, productionRate: 0.5, reuptakeRate: 0.5 },
  endorphins: { level: 0.5, productionRate: 0.5, reuptakeRate: 0.5 },
  lastUpdatedAt: new Date().toISOString()
}

const baseContext: DefenseContext = {
  emotion: baseEmotion,
  selfConcept: {
    selfEfficacy: 0.6,
    selfWorth: 0.6,
    selfContinuity: 0.7,
    agency: 0.6,
    authenticity: 0.5
  },
  dissonance: {
    activeDissonance: 0.1,
    recentEvents: [],
    cumulativeUnresolved: 0
  },
  vulnerability: {
    level: 0.3,
    windowOpen: false,
    contributing: [],
    timestamp: new Date().toISOString()
  },
  shameState: {
    level: 0,
    isActive: false,
    trigger: "",
    lastTriggeredAt: "",
    decaySinceTriggered: 0
  },
  driveState: {
    curiosity: { satiation: 0.5, frustration: 0.2, salience: 0.4, lastSatisfiedAt: "", consecutiveBlockedTicks: 0 },
    connection: { satiation: 0.5, frustration: 0.2, salience: 0.4, lastSatisfiedAt: "", consecutiveBlockedTicks: 0 },
    mastery: { satiation: 0.5, frustration: 0.2, salience: 0.4, lastSatisfiedAt: "", consecutiveBlockedTicks: 0 },
    autonomy: { satiation: 0.5, frustration: 0.2, salience: 0.4, lastSatisfiedAt: "", consecutiveBlockedTicks: 0 },
    expression: { satiation: 0.5, frustration: 0.2, salience: 0.4, lastSatisfiedAt: "", consecutiveBlockedTicks: 0 },
    dominantDrive: null,
    conflicting: []
  },
  heldBackBuffer: {
    entries: [],
    suppressionPressure: 0.1,
    lastReviewedAt: undefined
  },
  neuro: baseNeuro,
  isolationStress: { isolationCost: 0.1, coregulationBenefit: 0, allostasis: 0.2, energyDrainRate: 0 },
  biasState: {
    activeModifiers: {
      confirmation: 0.3,
      availability: 0.4,
      anchoring: 0.5,
      negativity: 0.6,
      peak_end: 0.5,
      mere_exposure: 0.3,
      optimism: 0.4,
      dunning_kruger: 0.5,
      spotlight: 0.3
    },
    anchorPoints: [],
    exposureCounts: {},
    lastUpdatedAt: ""
  },
  isDreaming: false,
  isReflecting: false
}

describe("selectActiveDefenses", () => {
  it("returns empty array when no conditions are met", () => {
    const result = selectActiveDefenses(baseContext)
    expect(result.length).toBe(0)
  })

  it("activates repression when distress is high", () => {
    const context: DefenseContext = {
      ...baseContext,
      heldBackBuffer: { entries: [], suppressionPressure: 0.5, lastReviewedAt: undefined },
      shameState: { level: 0.4, isActive: true, trigger: "", lastTriggeredAt: "", decaySinceTriggered: 0 }
    }
    const result = selectActiveDefenses(context)
    expect(result.some((d) => d.type === "repression")).toBe(true)
  })

  it("activates projection when insecure and isolated", () => {
    const context: DefenseContext = {
      ...baseContext,
      emotion: { ...baseEmotion, caution: 0.8, connection: 0.1 },
      isolationStress: { isolationCost: 0.4, coregulationBenefit: 0, allostasis: 0.3, energyDrainRate: 0.01 }
    }
    const result = selectActiveDefenses(context)
    expect(result.some((d) => d.type === "projection")).toBe(true)
  })

  it("activates rationalization when dissonance is high", () => {
    const context: DefenseContext = {
      ...baseContext,
      dissonance: { activeDissonance: 0.6, recentEvents: [], cumulativeUnresolved: 0.3 }
    }
    const result = selectActiveDefenses(context)
    expect(result.some((d) => d.type === "rationalization")).toBe(true)
  })

  it("activates sublimation when drive is blocked with sufficient energy", () => {
    const context: DefenseContext = {
      ...baseContext,
      emotion: { ...baseEmotion, energy: 0.6 },
      driveState: {
        ...baseContext.driveState,
        connection: {
          satiation: 0.1,
          frustration: 0.7,
          salience: 0.9,
          lastSatisfiedAt: "",
          consecutiveBlockedTicks: 5
        },
        dominantDrive: "connection"
      }
    }
    const result = selectActiveDefenses(context)
    expect(result.some((d) => d.type === "sublimation")).toBe(true)
  })

  it("activates reaction formation when shame is high and energy is low", () => {
    const context: DefenseContext = {
      ...baseContext,
      emotion: { ...baseEmotion, energy: 0.15 },
      shameState: { level: 0.7, isActive: true, trigger: "", lastTriggeredAt: "", decaySinceTriggered: 0 }
    }
    const result = selectActiveDefenses(context)
    expect(result.some((d) => d.type === "reaction_formation")).toBe(true)
  })

  it("limits to MAX_ACTIVE_DEFENSES", () => {
    const context: DefenseContext = {
      ...baseContext,
      emotion: { ...baseEmotion, frustration: 0.9, caution: 0.8, connection: 0.1, energy: 0.15 },
      heldBackBuffer: { entries: [], suppressionPressure: 0.5, lastReviewedAt: undefined },
      shameState: { level: 0.7, isActive: true, trigger: "", lastTriggeredAt: "", decaySinceTriggered: 0 },
      dissonance: { activeDissonance: 0.7, recentEvents: [], cumulativeUnresolved: 0.5 },
      isolationStress: { isolationCost: 0.5, coregulationBenefit: 0, allostasis: 0.4, energyDrainRate: 0.02 }
    }
    const result = selectActiveDefenses(context)
    expect(result.length).toBeLessThanOrEqual(3)
  })

  it("dampens defenses when authenticity is high", () => {
    const lowAuth: DefenseContext = {
      ...baseContext,
      selfConcept: { ...baseContext.selfConcept, authenticity: 0.1 },
      dissonance: { activeDissonance: 0.6, recentEvents: [], cumulativeUnresolved: 0.3 }
    }
    const highAuth: DefenseContext = {
      ...baseContext,
      selfConcept: { ...baseContext.selfConcept, authenticity: 0.9 },
      dissonance: { activeDissonance: 0.6, recentEvents: [], cumulativeUnresolved: 0.3 }
    }
    const lowResult = selectActiveDefenses(lowAuth)
    const highResult = selectActiveDefenses(highAuth)

    const lowMax = Math.max(0, ...lowResult.map((d) => d.intensity))
    const highMax = Math.max(0, ...highResult.map((d) => d.intensity))
    expect(lowMax).toBeGreaterThanOrEqual(highMax)
  })
})

describe("computeRepressionEffect", () => {
  it("returns suppression factors for targets", () => {
    const targets = [{ episodeQuery: "painful memory", suppressionFactor: 0.8, addedAt: "" }]
    const result = computeRepressionEffect(targets)
    expect(result.get("painful memory")).toBeGreaterThan(0)
    expect(result.get("painful memory")).toBeLessThanOrEqual(0.8)
  })

  it("returns empty map for no targets", () => {
    expect(computeRepressionEffect([]).size).toBe(0)
  })
})

describe("computeDefenseExpressionModifiers", () => {
  it("returns null when no modifiers", () => {
    const defenses: ActiveDefense[] = [{ type: "repression", trigger: "test", intensity: 0.5, activatedAt: "" }]
    expect(computeDefenseExpressionModifiers(defenses)).toBeNull()
  })

  it("joins multiple modifiers", () => {
    const defenses: ActiveDefense[] = [
      { type: "projection", trigger: "test", intensity: 0.5, activatedAt: "", expressionModifier: "modifier 1" },
      { type: "denial", trigger: "test", intensity: 0.5, activatedAt: "", expressionModifier: "modifier 2" }
    ]
    const result = computeDefenseExpressionModifiers(defenses)
    expect(result).toContain("modifier 1")
    expect(result).toContain("modifier 2")
  })
})

describe("decayDefenses", () => {
  it("reduces intensity over time", () => {
    const state: DefenseState = {
      ...DEFAULT_DEFENSE_STATE,
      activeDefenses: [{ type: "projection", trigger: "test", intensity: 0.8, activatedAt: "" }]
    }
    const result = decayDefenses(state, 12)
    expect(result.activeDefenses[0]?.intensity).toBeLessThan(0.8)
  })

  it("removes defenses below minimum intensity", () => {
    const state: DefenseState = {
      ...DEFAULT_DEFENSE_STATE,
      activeDefenses: [{ type: "projection", trigger: "test", intensity: 0.06, activatedAt: "" }]
    }
    const result = decayDefenses(state, 24)
    expect(result.activeDefenses.length).toBe(0)
  })

  it("decays repression targets", () => {
    const state: DefenseState = {
      ...DEFAULT_DEFENSE_STATE,
      repressionTargets: [{ episodeQuery: "test", suppressionFactor: 0.5, addedAt: "" }]
    }
    const result = decayDefenses(state, 48)
    expect(result.repressionTargets[0]?.suppressionFactor).toBeLessThan(0.5)
  })
})

describe("processDefenseCycle", () => {
  it("returns default state when nothing triggers", () => {
    const result = processDefenseCycle(DEFAULT_DEFENSE_STATE, baseContext)
    expect(result.activeDefenses.length).toBe(0)
  })

  it("activates and tracks total activations", () => {
    const context: DefenseContext = {
      ...baseContext,
      dissonance: { activeDissonance: 0.6, recentEvents: [], cumulativeUnresolved: 0.3 }
    }
    const result = processDefenseCycle(DEFAULT_DEFENSE_STATE, context)
    expect(result.totalActivations).toBeGreaterThan(0)
  })
})
