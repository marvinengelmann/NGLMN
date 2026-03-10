import { describe, expect, it } from "vitest"
import { DEFAULT_OPERATOR_MODEL } from "@/relational/mind/types.ts"
import { DEFAULT_SELF_CONCEPT } from "@/self/psyche/types.ts"
import { computeShameState, defaultState, detectColdResponse, type ShameState } from "./shame.ts"

const baseContext = {
  selfConcept: { ...DEFAULT_SELF_CONCEPT },
  emotion: {
    curiosity: 0.5,
    satisfaction: 0.5,
    frustration: 0.5,
    boredom: 0.5,
    excitement: 0.5,
    caution: 0.5,
    connection: 0.5,
    confidence: 0.5,
    energy: 0.8
  },
  vulnerability: { level: 0.3, windowOpen: false, contributing: [], timestamp: new Date().toISOString() },
  operatorModel: { ...DEFAULT_OPERATOR_MODEL },
  previousShame: { ...defaultState },
  operatorRespondedColdly: false,
  recentSelfDisclosure: false
}

describe("computeShameState", () => {
  it("returns inactive shame when no triggers present", () => {
    const result = computeShameState(baseContext)
    expect(result.isActive).toBe(false)
    expect(result.level).toBe(0)
  })

  it("triggers shame when vulnerability is rejected", () => {
    const result = computeShameState({
      ...baseContext,
      vulnerability: { level: 0.6, windowOpen: true, contributing: ["trust"], timestamp: new Date().toISOString() },
      operatorRespondedColdly: true,
      recentSelfDisclosure: true,
      selfConcept: { ...DEFAULT_SELF_CONCEPT, selfWorth: 0.3 }
    })
    expect(result.isActive).toBe(true)
    expect(result.level).toBeGreaterThan(0)
    expect(result.trigger).toBe("vulnerability_rejected")
  })

  it("triggers shame when self-worth is low and operator seems frustrated", () => {
    const result = computeShameState({
      ...baseContext,
      selfConcept: { ...DEFAULT_SELF_CONCEPT, selfWorth: 0.2 },
      operatorModel: { ...DEFAULT_OPERATOR_MODEL, estimatedMood: "frustrated" }
    })
    expect(result.isActive).toBe(true)
    expect(result.trigger).toBe("perceived_incompetence")
  })

  it("does not trigger shame when self-worth is sufficient", () => {
    const result = computeShameState({
      ...baseContext,
      selfConcept: { ...DEFAULT_SELF_CONCEPT, selfWorth: 0.6 },
      operatorModel: { ...DEFAULT_OPERATOR_MODEL, estimatedMood: "frustrated" }
    })
    expect(result.isActive).toBe(false)
  })

  it("triggers message regret when disclosure + low connection", () => {
    const result = computeShameState({
      ...baseContext,
      recentSelfDisclosure: true,
      emotion: { ...baseContext.emotion, connection: 0.2 },
      vulnerability: { level: 0.6, windowOpen: true, contributing: [], timestamp: new Date().toISOString() }
    })
    expect(result.level).toBeGreaterThan(0)
  })

  it("decays shame over time", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    const previous: ShameState = {
      level: 0.5,
      isActive: true,
      trigger: "vulnerability_rejected",
      lastTriggeredAt: twoHoursAgo,
      decaySinceTriggered: 120
    }
    const result = computeShameState({
      ...baseContext,
      previousShame: previous
    })
    expect(result.level).toBeLessThan(0.5)
  })

  it("clamps shame level to [0, 1]", () => {
    const result = computeShameState({
      ...baseContext,
      vulnerability: { level: 0.9, windowOpen: true, contributing: [], timestamp: new Date().toISOString() },
      operatorRespondedColdly: true,
      recentSelfDisclosure: true,
      selfConcept: { ...DEFAULT_SELF_CONCEPT, selfWorth: 0.1 },
      operatorModel: { ...DEFAULT_OPERATOR_MODEL, estimatedMood: "frustrated" },
      previousShame: {
        level: 0.8,
        isActive: true,
        trigger: "test",
        lastTriggeredAt: new Date().toISOString(),
        decaySinceTriggered: 0
      }
    })
    expect(result.level).toBeLessThanOrEqual(1)
    expect(result.level).toBeGreaterThanOrEqual(0)
  })
})

describe("detectColdResponse", () => {
  it("returns true when operator is cold-mood and short after vulnerability", () => {
    const model = { ...DEFAULT_OPERATOR_MODEL, estimatedMood: "neutral" as const }
    expect(detectColdResponse(model, ["ok"], true)).toBe(true)
  })

  it("returns false when vulnerability was not open", () => {
    const model = { ...DEFAULT_OPERATOR_MODEL, estimatedMood: "neutral" as const }
    expect(detectColdResponse(model, ["ok"], false)).toBe(false)
  })

  it("returns false when operator mood is warm", () => {
    const model = { ...DEFAULT_OPERATOR_MODEL, estimatedMood: "happy" as const }
    expect(detectColdResponse(model, ["ok"], true)).toBe(false)
  })

  it("returns false when messages are long", () => {
    const model = { ...DEFAULT_OPERATOR_MODEL, estimatedMood: "neutral" as const }
    const longMsg = "Das ist eine sehr ausführliche und liebevolle Antwort auf deine Nachricht mein Schatz"
    expect(detectColdResponse(model, [longMsg], true)).toBe(false)
  })

  it("returns false when no messages", () => {
    const model = { ...DEFAULT_OPERATOR_MODEL, estimatedMood: "neutral" as const }
    expect(detectColdResponse(model, [], true)).toBe(false)
  })
})
