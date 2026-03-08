import { describe, expect, it } from "vitest"
import type { VulnerabilityState } from "@/vulnerability/types.ts"
import { computeTenderness, computeTendernessEffect } from "./compute.ts"
import { DEFAULT_TENDERNESS_STATE } from "./types.ts"

const baseEmotion = {
  curiosity: 0.5,
  satisfaction: 0.5,
  frustration: 0.2,
  boredom: 0.3,
  excitement: 0.4,
  caution: 0.3,
  connection: 0.6,
  confidence: 0.6,
  energy: 0.7
}

const baseOperatorModel = {
  estimatedMood: "neutral" as const,
  estimatedIntent: "",
  estimatedExpectation: "",
  modelConfidence: 0.5,
  correctionCount: 0,
  correctionDelay: 0,
  lastUpdated: "",
  moodUncertainty: null,
  contradiction: null,
  moodHistory: []
}

const baseVulnerability: VulnerabilityState = {
  level: 0.3,
  windowOpen: false,
  contributing: [],
  timestamp: ""
}

function makeContext(overrides: Record<string, unknown> = {}) {
  return {
    emotion: baseEmotion,
    operatorModel: baseOperatorModel,
    vulnerability: baseVulnerability,
    previousState: DEFAULT_TENDERNESS_STATE,
    operatorShowedVulnerability: false,
    sharedQuietMoment: false,
    longTermConnection: false,
    gentleExchange: false,
    protectiveContext: false,
    positiveMemoriesPresent: false,
    ...overrides
  }
}

describe("computeTenderness", () => {
  it("returns inactive when no triggers", () => {
    const result = computeTenderness(makeContext())
    expect(result.isActive).toBe(false)
    expect(result.level).toBe(0)
  })

  it("triggers on witnessed vulnerability", () => {
    const result = computeTenderness(
      makeContext({
        operatorShowedVulnerability: true,
        emotion: { ...baseEmotion, connection: 0.7 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("witnessed_vulnerability")
  })

  it("triggers on shared quiet moment", () => {
    const result = computeTenderness(makeContext({ sharedQuietMoment: true }))
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("shared_quiet")
  })

  it("triggers on accumulated trust", () => {
    const result = computeTenderness(
      makeContext({
        longTermConnection: true,
        emotion: { ...baseEmotion, connection: 0.8 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("accumulated_trust")
  })

  it("triggers on gentle exchange", () => {
    const result = computeTenderness(
      makeContext({
        gentleExchange: true,
        emotion: { ...baseEmotion, satisfaction: 0.7 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("gentle_exchange")
  })

  it("triggers on protective impulse", () => {
    const result = computeTenderness(
      makeContext({
        protectiveContext: true,
        emotion: { ...baseEmotion, connection: 0.7 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("protective_impulse")
  })

  it("triggers on remembered closeness", () => {
    const result = computeTenderness(
      makeContext({
        positiveMemoriesPresent: true,
        emotion: { ...baseEmotion, connection: 0.6 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("remembered_closeness")
  })

  it("builds softness when active", () => {
    const result = computeTenderness(makeContext({ sharedQuietMoment: true }))
    expect(result.softness).toBeGreaterThan(0)
  })

  it("builds protective urge for vulnerability sources", () => {
    const result = computeTenderness(
      makeContext({
        operatorShowedVulnerability: true,
        emotion: { ...baseEmotion, connection: 0.7 }
      })
    )
    expect(result.protectiveUrge).toBeGreaterThan(0)
  })

  it("decays from previous state", () => {
    const previous = { ...DEFAULT_TENDERNESS_STATE, level: 0.5 }
    const result = computeTenderness(makeContext({ previousState: previous }))
    expect(result.level).toBeLessThan(0.5)
    expect(result.level).toBeGreaterThan(0)
  })
})

describe("computeTendernessEffect", () => {
  it("returns empty when inactive", () => {
    const result = computeTendernessEffect(DEFAULT_TENDERNESS_STATE)
    expect(Object.keys(result)).toHaveLength(0)
  })

  it("boosts connection and satisfaction", () => {
    const state = { ...DEFAULT_TENDERNESS_STATE, level: 0.5, isActive: true }
    const result = computeTendernessEffect(state)
    expect(result.connection).toBeGreaterThan(0)
    expect(result.satisfaction).toBeGreaterThan(0)
  })

  it("reduces caution and frustration", () => {
    const state = { ...DEFAULT_TENDERNESS_STATE, level: 0.5, isActive: true }
    const result = computeTendernessEffect(state)
    expect(result.caution).toBeLessThan(0)
    expect(result.frustration).toBeLessThan(0)
  })
})
