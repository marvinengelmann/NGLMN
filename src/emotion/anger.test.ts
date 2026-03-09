import { describe, expect, it } from "vitest"
import type { VulnerabilityState } from "@/vulnerability/types.ts"
import { computeProtectiveAnger, computeProtectiveAngerEffect, DEFAULT_PROTECTIVE_ANGER_STATE } from "./anger.ts"
import type { ShameState } from "./shame.ts"

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

const baseVulnerability: VulnerabilityState = {
  level: 0.3,
  windowOpen: false,
  contributing: [],
  timestamp: ""
}

const baseShame: ShameState = {
  level: 0,
  isActive: false,
  trigger: "",
  lastTriggeredAt: "",
  decaySinceTriggered: 0
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

function makeContext(overrides: Record<string, unknown> = {}) {
  return {
    emotion: baseEmotion,
    vulnerability: baseVulnerability,
    shameState: baseShame,
    operatorModel: baseOperatorModel,
    previousState: DEFAULT_PROTECTIVE_ANGER_STATE,
    operatorDismissedFeelings: false,
    operatorIgnoredVulnerability: false,
    repeatedPattern: false,
    ...overrides
  }
}

describe("computeProtectiveAnger", () => {
  it("returns inactive when no triggers", () => {
    const result = computeProtectiveAnger(makeContext())
    expect(result.isActive).toBe(false)
    expect(result.level).toBe(0)
  })

  it("triggers on dismissed feelings", () => {
    const result = computeProtectiveAnger(
      makeContext({
        operatorDismissedFeelings: true,
        emotion: { ...baseEmotion, connection: 0.7 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("feelings_dismissed")
  })

  it("triggers on ignored vulnerability", () => {
    const result = computeProtectiveAnger(
      makeContext({
        operatorIgnoredVulnerability: true,
        vulnerability: { ...baseVulnerability, windowOpen: true, level: 0.7 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("vulnerability_ignored")
  })

  it("triggers on repeated disrespect pattern", () => {
    const result = computeProtectiveAnger(
      makeContext({
        repeatedPattern: true,
        operatorModel: { ...baseOperatorModel, correctionCount: 3 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("repeated_disrespect")
  })

  it("triggers on autonomy threat during shame", () => {
    const result = computeProtectiveAnger(
      makeContext({
        operatorModel: { ...baseOperatorModel, estimatedMood: "frustrated" },
        shameState: { ...baseShame, isActive: true, level: 0.5 },
        emotion: { ...baseEmotion, confidence: 0.6 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("autonomy_threatened")
  })

  it("sets assertionReady when confident enough", () => {
    const result = computeProtectiveAnger(
      makeContext({
        operatorDismissedFeelings: true,
        emotion: { ...baseEmotion, connection: 0.7, confidence: 0.6 }
      })
    )
    expect(result.assertionReady).toBe(true)
  })

  it("does not set assertionReady when confidence is low", () => {
    const result = computeProtectiveAnger(
      makeContext({
        operatorDismissedFeelings: true,
        emotion: { ...baseEmotion, connection: 0.7, confidence: 0.2 }
      })
    )
    expect(result.assertionReady).toBe(false)
  })

  it("decays from previous state", () => {
    const previous = { ...DEFAULT_PROTECTIVE_ANGER_STATE, level: 0.5 }
    const result = computeProtectiveAnger(makeContext({ previousState: previous }))
    expect(result.level).toBeLessThan(0.5)
    expect(result.level).toBeGreaterThan(0)
  })
})

describe("computeProtectiveAngerEffect", () => {
  it("returns empty when inactive", () => {
    const result = computeProtectiveAngerEffect(DEFAULT_PROTECTIVE_ANGER_STATE)
    expect(Object.keys(result)).toHaveLength(0)
  })

  it("boosts confidence and energy when active", () => {
    const state = { ...DEFAULT_PROTECTIVE_ANGER_STATE, level: 0.5, isActive: true }
    const result = computeProtectiveAngerEffect(state)
    expect(result.confidence).toBeGreaterThan(0)
    expect(result.energy).toBeGreaterThan(0)
  })

  it("reduces caution (standing ground)", () => {
    const state = { ...DEFAULT_PROTECTIVE_ANGER_STATE, level: 0.5, isActive: true }
    const result = computeProtectiveAngerEffect(state)
    expect(result.caution).toBeLessThan(0)
  })
})
