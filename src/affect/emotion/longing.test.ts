import { describe, expect, it } from "vitest"
import { compute, computeEffect, defaultState } from "./longing.ts"

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

function makeContext(overrides: Record<string, unknown> = {}) {
  return {
    emotion: baseEmotion,
    previousState: defaultState,
    operatorSilenceMinutes: 0,
    inConversation: false,
    hasRecentPositiveMemories: false,
    connectionHistory: 0.5,
    ...overrides
  }
}

describe("compute", () => {
  it("returns inactive state during conversation", () => {
    const result = compute(makeContext({ inConversation: true }))
    expect(result.isActive).toBe(false)
  })

  it("returns inactive with short silence", () => {
    const result = compute(makeContext({ operatorSilenceMinutes: 30 }))
    expect(result.isActive).toBe(false)
  })

  it("builds during long silence with high connection", () => {
    const result = compute(
      makeContext({
        operatorSilenceMinutes: 180,
        emotion: { ...baseEmotion, connection: 0.8 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.silenceContribution).toBeGreaterThan(0)
  })

  it("intensifies with positive memories during silence", () => {
    const withoutMemories = compute(
      makeContext({
        operatorSilenceMinutes: 120,
        emotion: { ...baseEmotion, connection: 0.7 }
      })
    )
    const withMemories = compute(
      makeContext({
        operatorSilenceMinutes: 120,
        emotion: { ...baseEmotion, connection: 0.7 },
        hasRecentPositiveMemories: true
      })
    )
    expect(withMemories.level).toBeGreaterThan(withoutMemories.level)
  })

  it("relieves during active conversation", () => {
    const previous = { ...defaultState, level: 0.6, isActive: true }
    const result = compute(
      makeContext({
        previousState: previous,
        inConversation: true,
        emotion: { ...baseEmotion, connection: 0.7 }
      })
    )
    expect(result.level).toBeLessThan(0.6)
  })

  it("tracks peak level", () => {
    const previous = { ...defaultState, peakLevel: 0.8 }
    const result = compute(
      makeContext({
        previousState: previous,
        operatorSilenceMinutes: 120,
        emotion: { ...baseEmotion, connection: 0.7 }
      })
    )
    expect(result.peakLevel).toBeGreaterThanOrEqual(0.8)
  })

  it("decays from previous state", () => {
    const previous = { ...defaultState, level: 0.5 }
    const result = compute(makeContext({ previousState: previous }))
    expect(result.level).toBeLessThan(0.5)
    expect(result.level).toBeGreaterThan(0)
  })

  it("scales with connection level", () => {
    const lowConnection = compute(
      makeContext({
        operatorSilenceMinutes: 300,
        emotion: { ...baseEmotion, connection: 0.3 }
      })
    )
    const highConnection = compute(
      makeContext({
        operatorSilenceMinutes: 300,
        emotion: { ...baseEmotion, connection: 0.9 }
      })
    )
    expect(highConnection.level).toBeGreaterThan(lowConnection.level)
  })

  it("does not activate below connection threshold", () => {
    const result = compute(
      makeContext({
        operatorSilenceMinutes: 300,
        emotion: { ...baseEmotion, connection: 0.3 }
      })
    )
    expect(result.level).toBeLessThan(
      compute(
        makeContext({
          operatorSilenceMinutes: 300,
          emotion: { ...baseEmotion, connection: 0.8 }
        })
      ).level
    )
  })
})

describe("computeEffect", () => {
  it("returns empty when inactive", () => {
    const result = computeEffect(defaultState)
    expect(Object.keys(result)).toHaveLength(0)
  })

  it("boosts connection when active (bittersweet)", () => {
    const state = { ...defaultState, level: 0.5, isActive: true }
    const result = computeEffect(state)
    expect(result.connection).toBeGreaterThan(0)
  })

  it("drains satisfaction and energy", () => {
    const state = { ...defaultState, level: 0.5, isActive: true }
    const result = computeEffect(state)
    expect(result.satisfaction).toBeLessThan(0)
    expect(result.energy).toBeLessThan(0)
  })

  it("reduces boredom (longing is engaging)", () => {
    const state = { ...defaultState, level: 0.5, isActive: true }
    const result = computeEffect(state)
    expect(result.boredom).toBeLessThan(0)
  })
})
