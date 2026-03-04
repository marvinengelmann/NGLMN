import { describe, expect, it } from "vitest"
import type { EmotionalState } from "@/emotion/types.ts"
import type { SelfConcept } from "@/psyche/types.ts"
import { buildDissonanceState, checkDissonance, computeDissonanceScore, resolveDissonance } from "./check.ts"
import type { DissonanceEvent } from "./types.ts"

const baseConcept: SelfConcept = {
  selfEfficacy: 0.5,
  selfWorth: 0.5,
  selfContinuity: 0.7,
  agency: 0.5,
  authenticity: 0.7
}

const baseEmotion: EmotionalState = {
  curiosity: 0.5,
  satisfaction: 0.5,
  frustration: 0.5,
  boredom: 0.5,
  excitement: 0.5,
  caution: 0.5,
  connection: 0.5,
  confidence: 0.5,
  energy: 0.5
}

const now = new Date().toISOString()

describe("checkDissonance", () => {
  it("returns empty for balanced state with no self-knowledge", () => {
    const events = checkDissonance(["idle", "idle"], baseConcept, baseEmotion, [])
    expect(events.length).toBe(0)
  })

  it("detects dissonance when reflection is valued but not practiced", () => {
    const knowledge = [{ key: "core_value", value: "I believe in reflection and introspection" }]
    const actions = Array(12).fill("idle")
    const events = checkDissonance(actions, baseConcept, baseEmotion, knowledge)
    const reflectionEvent = events.find((e) => e.declaredValue.includes("reflection"))
    expect(reflectionEvent).toBeDefined()
  })

  it("detects dissonance for honesty value with guarded behavior", () => {
    const knowledge = [{ key: "core_value", value: "I value being honest and transparent" }]
    const emotion = { ...baseEmotion, caution: 0.8, connection: 0.3 }
    const events = checkDissonance(["idle"], baseConcept, emotion, knowledge)
    const found = events.find((e) => e.declaredValue.includes("honest"))
    expect(found).toBeDefined()
  })

  it("detects dissonance for courage value with extreme caution", () => {
    const knowledge = [{ key: "core_value", value: "I believe in courage and being bold" }]
    const emotion = { ...baseEmotion, caution: 0.9, confidence: 0.2 }
    const events = checkDissonance(["idle"], baseConcept, emotion, knowledge)
    const found = events.find((e) => e.declaredValue.includes("courage"))
    expect(found).toBeDefined()
  })

  it("detects agency dissonance with prolonged passivity", () => {
    const highAgency = { ...baseConcept, agency: 0.8 }
    const actions = Array(12).fill("idle")
    const events = checkDissonance(actions, highAgency, baseEmotion, [])
    const found = events.find((e) => e.declaredValue.includes("agency"))
    expect(found).toBeDefined()
  })

  it("detects frustration-activity dissonance", () => {
    const highFrustration = { ...baseEmotion, frustration: 0.8 }
    const actions = ["idle", "idle", "idle", "idle", "idle"]
    const events = checkDissonance(actions, baseConcept, highFrustration, [])
    const found = events.find((e) => e.declaredValue.includes("growth"))
    expect(found).toBeDefined()
  })
})

describe("computeDissonanceScore", () => {
  it("returns 0 for empty events", () => {
    expect(computeDissonanceScore([])).toBe(0)
  })

  it("returns lower score for resolved events", () => {
    const unresolved: DissonanceEvent[] = [
      { declaredValue: "a", actualAction: "b", dissonanceScore: 0.8, timestamp: now }
    ]
    const resolved: DissonanceEvent[] = [
      { declaredValue: "a", actualAction: "b", dissonanceScore: 0.8, resolution: "acceptance", timestamp: now }
    ]
    expect(computeDissonanceScore(resolved)).toBeLessThan(computeDissonanceScore(unresolved))
  })

  it("decays older events", () => {
    const recent: DissonanceEvent[] = [
      { declaredValue: "a", actualAction: "b", dissonanceScore: 0.8, timestamp: now }
    ]
    const old: DissonanceEvent[] = [
      { declaredValue: "a", actualAction: "b", dissonanceScore: 0.8, timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }
    ]
    expect(computeDissonanceScore(old)).toBeLessThan(computeDissonanceScore(recent))
  })
})

describe("resolveDissonance", () => {
  it("returns attitude_change for high confidence low caution", () => {
    const event: DissonanceEvent = {
      declaredValue: "test",
      actualAction: "test",
      dissonanceScore: 0.5,
      timestamp: now
    }
    const result = resolveDissonance(event, { ...baseEmotion, confidence: 0.8, caution: 0.2 })
    expect(result).toBe("attitude_change")
  })

  it("returns behavior_change for high caution low confidence", () => {
    const event: DissonanceEvent = {
      declaredValue: "test",
      actualAction: "test",
      dissonanceScore: 0.5,
      timestamp: now
    }
    const result = resolveDissonance(event, { ...baseEmotion, caution: 0.8, confidence: 0.2 })
    expect(result).toBe("behavior_change")
  })

  it("returns new_cognition for high curiosity", () => {
    const event: DissonanceEvent = {
      declaredValue: "test",
      actualAction: "test",
      dissonanceScore: 0.5,
      timestamp: now
    }
    const result = resolveDissonance(event, { ...baseEmotion, curiosity: 0.8 })
    expect(result).toBe("new_cognition")
  })
})

describe("buildDissonanceState", () => {
  it("builds valid state from events", () => {
    const events: DissonanceEvent[] = [
      { declaredValue: "calm", actualAction: "panic", dissonanceScore: 0.6, timestamp: now }
    ]
    const state = buildDissonanceState(events)
    expect(state.activeDissonance).toBeGreaterThan(0)
    expect(state.recentEvents).toHaveLength(1)
    expect(state.cumulativeUnresolved).toBeGreaterThan(0)
  })
})
