import { describe, expect, it, vi } from "vitest"
import type { EmotionalState } from "@/affect/emotion/types.ts"
import type { SelfConcept } from "@/self/psyche/types.ts"
import { buildDissonanceState, checkDissonance, computeDissonanceScore, resolveDissonance } from "./compute.ts"
import type { DissonanceEvent } from "./types.ts"

vi.mock("@/core/intelligence.ts", () => ({
  callIntelligence: vi.fn().mockReturnValue(
    Promise.resolve({
      isOk: () => true,
      isErr: () => false,
      value: {
        mismatches: [
          {
            declaredValue: "values honesty and transparency",
            actualAction: "guarded behavior with high caution",
            dissonanceScore: 0.4
          }
        ]
      }
    })
  )
}))

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
  it("returns empty for balanced state with no self-knowledge", async () => {
    const events = await checkDissonance(["idle", "idle"], baseConcept, baseEmotion, [])
    expect(events.length).toBe(0)
  })

  it("returns LLM-identified mismatches when self-knowledge is present", async () => {
    const knowledge = [{ key: "core_value", value: "I value being honest and transparent" }]
    const events = await checkDissonance(["idle"], baseConcept, baseEmotion, knowledge)
    expect(events.length).toBeGreaterThan(0)
    expect(events[0]?.dissonanceScore).toBeGreaterThan(0)
  })

  it("detects agency dissonance with prolonged passivity", async () => {
    const highAgency = { ...baseConcept, agency: 0.8 }
    const actions = Array(12).fill("idle")
    const events = await checkDissonance(actions, highAgency, baseEmotion, [])
    const found = events.find((e: DissonanceEvent) => e.declaredValue.includes("agency"))
    expect(found).toBeDefined()
  })

  it("detects authenticity dissonance when frustrated and disconnected", async () => {
    const highAuth = { ...baseConcept, authenticity: 0.8 }
    const emotion = { ...baseEmotion, frustration: 0.7, connection: 0.2 }
    const events = await checkDissonance(["idle"], highAuth, emotion, [])
    const found = events.find((e: DissonanceEvent) => e.declaredValue.includes("authenticity"))
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
    const recent: DissonanceEvent[] = [{ declaredValue: "a", actualAction: "b", dissonanceScore: 0.8, timestamp: now }]
    const old: DissonanceEvent[] = [
      {
        declaredValue: "a",
        actualAction: "b",
        dissonanceScore: 0.8,
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      }
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
