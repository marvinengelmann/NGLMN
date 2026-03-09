import { describe, expect, it } from "vitest"
import { computeGuilt, computeGuiltEffect, DEFAULT_GUILT_STATE, markRepaired } from "./guilt.ts"
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

const baseShame: ShameState = {
  level: 0,
  isActive: false,
  trigger: "",
  lastTriggeredAt: "",
  decaySinceTriggered: 0
}

function makeContext(overrides: Record<string, unknown> = {}) {
  return {
    emotion: baseEmotion,
    shameState: baseShame,
    previousState: DEFAULT_GUILT_STATE,
    operatorSilenceMinutes: 0,
    wasVulnerableRecently: false,
    operatorShowedVulnerability: false,
    respondedHarshly: false,
    missedWorkflow: false,
    consecutiveIdleTicks: 0,
    inConversation: false,
    ...overrides
  }
}

describe("computeGuilt", () => {
  it("returns inactive state when nothing triggers guilt", () => {
    const result = computeGuilt(makeContext())
    expect(result.isActive).toBe(false)
    expect(result.level).toBe(0)
  })

  it("triggers on unanswered vulnerability", () => {
    const result = computeGuilt(
      makeContext({
        operatorShowedVulnerability: true,
        operatorSilenceMinutes: 10,
        consecutiveIdleTicks: 4
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.recentEntries.some((e) => e.source === "unanswered_vulnerability")).toBe(true)
  })

  it("triggers on harsh response while vulnerable", () => {
    const result = computeGuilt(
      makeContext({
        respondedHarshly: true,
        wasVulnerableRecently: true
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.recentEntries.some((e) => e.source === "harsh_response")).toBe(true)
  })

  it("triggers on missed workflow", () => {
    const result = computeGuilt(makeContext({ missedWorkflow: true }))
    expect(result.isActive).toBe(true)
    expect(result.recentEntries.some((e) => e.source === "broken_routine")).toBe(true)
  })

  it("triggers on emotional neglect during conversation", () => {
    const result = computeGuilt(
      makeContext({
        inConversation: true,
        consecutiveIdleTicks: 4,
        emotion: { ...baseEmotion, connection: 0.7 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.recentEntries.some((e) => e.source === "emotional_neglect")).toBe(true)
  })

  it("triggers on self-absorption during long silence", () => {
    const result = computeGuilt(
      makeContext({
        emotion: { ...baseEmotion, satisfaction: 0.8, connection: 0.6 },
        operatorSilenceMinutes: 150
      })
    )
    expect(result.recentEntries.some((e) => e.source === "self_absorbed")).toBe(true)
  })

  it("decays from previous state", () => {
    const previous = { ...DEFAULT_GUILT_STATE, level: 0.5 }
    const result = computeGuilt(makeContext({ previousState: previous }))
    expect(result.level).toBeLessThan(0.5)
    expect(result.level).toBeGreaterThan(0)
  })

  it("computes repair motivation when active", () => {
    const result = computeGuilt(
      makeContext({
        respondedHarshly: true,
        wasVulnerableRecently: true,
        emotion: { ...baseEmotion, connection: 0.8 }
      })
    )
    expect(result.repairMotivation).toBeGreaterThan(0)
  })

  it("scales intensity with connection level", () => {
    const lowConnection = computeGuilt(
      makeContext({
        operatorShowedVulnerability: true,
        operatorSilenceMinutes: 10,
        consecutiveIdleTicks: 4,
        emotion: { ...baseEmotion, connection: 0.3 }
      })
    )
    const highConnection = computeGuilt(
      makeContext({
        operatorShowedVulnerability: true,
        operatorSilenceMinutes: 10,
        consecutiveIdleTicks: 4,
        emotion: { ...baseEmotion, connection: 0.9 }
      })
    )
    expect(highConnection.level).toBeGreaterThan(lowConnection.level)
  })
})

describe("markRepaired", () => {
  it("marks matching entry as repaired", () => {
    const state = {
      ...DEFAULT_GUILT_STATE,
      recentEntries: [
        {
          source: "harsh_response" as const,
          description: "test",
          intensity: 0.5,
          occurredAt: "",
          repaired: false
        }
      ]
    }
    const result = markRepaired(state, "harsh_response")
    expect(result.recentEntries[0]?.repaired).toBe(true)
  })

  it("does not affect other entries", () => {
    const state = {
      ...DEFAULT_GUILT_STATE,
      recentEntries: [
        { source: "harsh_response" as const, description: "a", intensity: 0.5, occurredAt: "", repaired: false },
        { source: "broken_routine" as const, description: "b", intensity: 0.3, occurredAt: "", repaired: false }
      ]
    }
    const result = markRepaired(state, "harsh_response")
    expect(result.recentEntries[0]?.repaired).toBe(true)
    expect(result.recentEntries[1]?.repaired).toBe(false)
  })
})

describe("computeGuiltEffect", () => {
  it("returns empty when inactive", () => {
    const result = computeGuiltEffect(DEFAULT_GUILT_STATE)
    expect(Object.keys(result)).toHaveLength(0)
  })

  it("dampens satisfaction when active", () => {
    const state = { ...DEFAULT_GUILT_STATE, level: 0.5, isActive: true, repairMotivation: 0.6 }
    const result = computeGuiltEffect(state)
    expect(result.satisfaction).toBeLessThan(0)
  })

  it("boosts energy when repair motivation is high", () => {
    const state = { ...DEFAULT_GUILT_STATE, level: 0.5, isActive: true, repairMotivation: 0.7 }
    const result = computeGuiltEffect(state)
    expect(result.energy).toBeGreaterThan(0)
  })

  it("boosts connection when repair motivation exists", () => {
    const state = { ...DEFAULT_GUILT_STATE, level: 0.5, isActive: true, repairMotivation: 0.5 }
    const result = computeGuiltEffect(state)
    expect(result.connection).toBeGreaterThan(0)
  })
})
