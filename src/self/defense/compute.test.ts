import { describe, expect, it } from "vitest"
import {
  computeRegulationExpressionModifiers,
  computeSuppressionEffect,
  decayStrategies,
  processRegulationCycle,
  type RegulationContext,
  selectActiveStrategies
} from "./compute.ts"
import { type ActiveStrategy, DEFAULT_EMOTION_REGULATION_STATE, type EmotionRegulationState } from "./types.ts"

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
  gaba: { level: 0.5, productionRate: 0.5, reuptakeRate: 0.5 },
  dopamineDetail: { tonicLevel: 0.45, phasicLevel: 0.05 },
  crhBuffer: 0,
  lastUpdatedAt: new Date().toISOString()
}

const baseContext: RegulationContext = {
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
  isolationStress: {
    isolationCost: 0.1,
    coregulationBenefit: 0,
    allostasis: 0.2,
    energyDrainRate: 0,
    cortisolStressSignal: 0
  },
  biasState: {
    activeModifiers: {
      confirmation: 0.3,
      availability: 0.4,
      anchoring: 0.5,
      negativity: 0.6,
      peak_end: 0.5,
      mere_exposure: 0.3,
      optimism: 0.4,
      calibration_bias: 0.5,
      spotlight: 0.3,
      fundamental_attribution: 0.4,
      false_consensus: 0.3,
      projection: 0.3
    },
    anchorPoints: [],
    exposureCounts: {},
    lastUpdatedAt: ""
  },
  isDreaming: false,
  isReflecting: false
}

describe("selectActiveStrategies", () => {
  it("returns empty array when no conditions are met", () => {
    const result = selectActiveStrategies(baseContext)
    expect(result.length).toBe(0)
  })

  it("activates suppression when distress is high", () => {
    const context: RegulationContext = {
      ...baseContext,
      heldBackBuffer: { entries: [], suppressionPressure: 0.5, lastReviewedAt: undefined },
      shameState: { level: 0.4, isActive: true, trigger: "", lastTriggeredAt: "", decaySinceTriggered: 0 }
    }
    const result = selectActiveStrategies(context)
    expect(result.some((d) => d.type === "suppression")).toBe(true)
  })

  it("activates attribution_bias when insecure and isolated", () => {
    const context: RegulationContext = {
      ...baseContext,
      emotion: { ...baseEmotion, caution: 0.8, connection: 0.1 },
      isolationStress: {
        isolationCost: 0.4,
        coregulationBenefit: 0,
        allostasis: 0.3,
        energyDrainRate: 0.01,
        cortisolStressSignal: 0
      }
    }
    const result = selectActiveStrategies(context)
    expect(result.some((d) => d.type === "attribution_bias")).toBe(true)
  })

  it("activates reappraisal when dissonance is high", () => {
    const context: RegulationContext = {
      ...baseContext,
      dissonance: { activeDissonance: 0.6, recentEvents: [], cumulativeUnresolved: 0.3 }
    }
    const result = selectActiveStrategies(context)
    expect(result.some((d) => d.type === "reappraisal")).toBe(true)
  })

  it("activates behavioral_activation when drive is blocked with sufficient energy", () => {
    const context: RegulationContext = {
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
    const result = selectActiveStrategies(context)
    expect(result.some((d) => d.type === "behavioral_activation")).toBe(true)
  })

  it("activates expressive_suppression when shame is high and energy is low", () => {
    const context: RegulationContext = {
      ...baseContext,
      emotion: { ...baseEmotion, energy: 0.15 },
      shameState: { level: 0.7, isActive: true, trigger: "", lastTriggeredAt: "", decaySinceTriggered: 0 }
    }
    const result = selectActiveStrategies(context)
    expect(result.some((d) => d.type === "expressive_suppression")).toBe(true)
  })

  it("limits to MAX_ACTIVE_STRATEGIES", () => {
    const context: RegulationContext = {
      ...baseContext,
      emotion: { ...baseEmotion, frustration: 0.9, caution: 0.8, connection: 0.1, energy: 0.15 },
      heldBackBuffer: { entries: [], suppressionPressure: 0.5, lastReviewedAt: undefined },
      shameState: { level: 0.7, isActive: true, trigger: "", lastTriggeredAt: "", decaySinceTriggered: 0 },
      dissonance: { activeDissonance: 0.7, recentEvents: [], cumulativeUnresolved: 0.5 },
      isolationStress: {
        isolationCost: 0.5,
        coregulationBenefit: 0,
        allostasis: 0.4,
        energyDrainRate: 0.02,
        cortisolStressSignal: 0
      }
    }
    const result = selectActiveStrategies(context)
    expect(result.length).toBeLessThanOrEqual(3)
  })

  it("dampens strategies when authenticity is high", () => {
    const lowAuth: RegulationContext = {
      ...baseContext,
      selfConcept: { ...baseContext.selfConcept, authenticity: 0.1 },
      dissonance: { activeDissonance: 0.6, recentEvents: [], cumulativeUnresolved: 0.3 }
    }
    const highAuth: RegulationContext = {
      ...baseContext,
      selfConcept: { ...baseContext.selfConcept, authenticity: 0.9 },
      dissonance: { activeDissonance: 0.6, recentEvents: [], cumulativeUnresolved: 0.3 }
    }
    const lowResult = selectActiveStrategies(lowAuth)
    const highResult = selectActiveStrategies(highAuth)

    const lowMax = Math.max(0, ...lowResult.map((d) => d.intensity))
    const highMax = Math.max(0, ...highResult.map((d) => d.intensity))
    expect(lowMax).toBeGreaterThanOrEqual(highMax)
  })
})

describe("computeSuppressionEffect", () => {
  it("returns suppression factors for targets", () => {
    const targets = [{ episodeQuery: "painful memory", suppressionFactor: 0.8, addedAt: "" }]
    const result = computeSuppressionEffect(targets)
    expect(result.get("painful memory")).toBeGreaterThan(0)
    expect(result.get("painful memory")).toBeLessThanOrEqual(0.8)
  })

  it("returns empty map for no targets", () => {
    expect(computeSuppressionEffect([]).size).toBe(0)
  })
})

describe("computeRegulationExpressionModifiers", () => {
  it("returns null when no modifiers", () => {
    const strategies: ActiveStrategy[] = [{ type: "suppression", trigger: "test", intensity: 0.5, activatedAt: "" }]
    expect(computeRegulationExpressionModifiers(strategies)).toBeNull()
  })

  it("joins multiple modifiers", () => {
    const strategies: ActiveStrategy[] = [
      { type: "attribution_bias", trigger: "test", intensity: 0.5, activatedAt: "", expressionModifier: "modifier 1" },
      {
        type: "selective_attention",
        trigger: "test",
        intensity: 0.5,
        activatedAt: "",
        expressionModifier: "modifier 2"
      }
    ]
    const result = computeRegulationExpressionModifiers(strategies)
    expect(result).toContain("modifier 1")
    expect(result).toContain("modifier 2")
  })
})

describe("decayStrategies", () => {
  it("reduces intensity over time", () => {
    const state: EmotionRegulationState = {
      ...DEFAULT_EMOTION_REGULATION_STATE,
      activeStrategies: [{ type: "attribution_bias", trigger: "test", intensity: 0.8, activatedAt: "" }]
    }
    const result = decayStrategies(state, 12)
    expect(result.activeStrategies[0]?.intensity).toBeLessThan(0.8)
  })

  it("removes strategies below minimum intensity", () => {
    const state: EmotionRegulationState = {
      ...DEFAULT_EMOTION_REGULATION_STATE,
      activeStrategies: [{ type: "attribution_bias", trigger: "test", intensity: 0.06, activatedAt: "" }]
    }
    const result = decayStrategies(state, 24)
    expect(result.activeStrategies.length).toBe(0)
  })

  it("decays suppression targets", () => {
    const state: EmotionRegulationState = {
      ...DEFAULT_EMOTION_REGULATION_STATE,
      suppressionTargets: [{ episodeQuery: "test", suppressionFactor: 0.5, addedAt: "" }]
    }
    const result = decayStrategies(state, 48)
    expect(result.suppressionTargets[0]?.suppressionFactor).toBeLessThan(0.5)
  })
})

describe("processRegulationCycle", () => {
  it("returns default state when nothing triggers", () => {
    const result = processRegulationCycle(DEFAULT_EMOTION_REGULATION_STATE, baseContext)
    expect(result.activeStrategies.length).toBe(0)
  })

  it("activates and tracks total activations", () => {
    const context: RegulationContext = {
      ...baseContext,
      dissonance: { activeDissonance: 0.6, recentEvents: [], cumulativeUnresolved: 0.3 }
    }
    const result = processRegulationCycle(DEFAULT_EMOTION_REGULATION_STATE, context)
    expect(result.totalActivations).toBeGreaterThan(0)
  })
})
