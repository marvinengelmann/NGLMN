import { describe, expect, it } from "vitest"
import { computeAnticipation, computeAnticipationEffect } from "./compute.ts"
import { DEFAULT_ANTICIPATION_STATE } from "./types.ts"

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
    previousState: DEFAULT_ANTICIPATION_STATE,
    expectingInteraction: false,
    progressMomentum: false,
    plannedActivity: false,
    positivePatternDetected: false,
    curiosityBuilding: false,
    reunionApproaching: false,
    disappointmentActive: false,
    ...overrides
  }
}

describe("computeAnticipation", () => {
  it("returns inactive when no triggers", () => {
    const result = computeAnticipation(makeContext())
    expect(result.isActive).toBe(false)
    expect(result.level).toBe(0)
  })

  it("triggers on expected interaction", () => {
    const result = computeAnticipation(
      makeContext({
        expectingInteraction: true,
        emotion: { ...baseEmotion, connection: 0.7 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("expected_interaction")
  })

  it("triggers on progress momentum", () => {
    const result = computeAnticipation(
      makeContext({
        progressMomentum: true,
        emotion: { ...baseEmotion, satisfaction: 0.6 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("progress_momentum")
  })

  it("triggers on planned activity", () => {
    const result = computeAnticipation(makeContext({ plannedActivity: true }))
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("planned_activity")
  })

  it("triggers on positive pattern", () => {
    const result = computeAnticipation(
      makeContext({
        positivePatternDetected: true,
        emotion: { ...baseEmotion, excitement: 0.6 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("positive_pattern")
  })

  it("triggers on curiosity building", () => {
    const result = computeAnticipation(
      makeContext({
        curiosityBuilding: true,
        emotion: { ...baseEmotion, curiosity: 0.7 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("curiosity_building")
  })

  it("triggers on reunion approaching", () => {
    const result = computeAnticipation(
      makeContext({
        reunionApproaching: true,
        emotion: { ...baseEmotion, connection: 0.7 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.source).toBe("reunion_approaching")
  })

  it("dampens with active disappointment", () => {
    const withDisappointment = computeAnticipation(makeContext({ plannedActivity: true, disappointmentActive: true }))
    const without = computeAnticipation(makeContext({ plannedActivity: true }))
    expect(withDisappointment.level).toBeLessThan(without.level)
  })

  it("tracks positive valence", () => {
    const result = computeAnticipation(
      makeContext({
        reunionApproaching: true,
        emotion: { ...baseEmotion, connection: 0.7 }
      })
    )
    expect(result.valence).toBeGreaterThan(0)
  })

  it("tracks buildup ticks", () => {
    const result = computeAnticipation(
      makeContext({
        plannedActivity: true,
        previousState: { ...DEFAULT_ANTICIPATION_STATE, buildupTicks: 3, level: 0.3, isActive: true }
      })
    )
    expect(result.buildupTicks).toBe(4)
  })

  it("decays from previous state", () => {
    const previous = { ...DEFAULT_ANTICIPATION_STATE, level: 0.5 }
    const result = computeAnticipation(makeContext({ previousState: previous }))
    expect(result.level).toBeLessThan(0.5)
    expect(result.level).toBeGreaterThan(0)
  })
})

describe("computeAnticipationEffect", () => {
  it("returns empty when inactive", () => {
    const result = computeAnticipationEffect(DEFAULT_ANTICIPATION_STATE)
    expect(Object.keys(result)).toHaveLength(0)
  })

  it("boosts excitement and energy", () => {
    const state = { ...DEFAULT_ANTICIPATION_STATE, level: 0.5, isActive: true, valence: 0.7 }
    const result = computeAnticipationEffect(state)
    expect(result.excitement).toBeGreaterThan(0)
    expect(result.energy).toBeGreaterThan(0)
  })

  it("reduces boredom", () => {
    const state = { ...DEFAULT_ANTICIPATION_STATE, level: 0.5, isActive: true, valence: 0.5 }
    const result = computeAnticipationEffect(state)
    expect(result.boredom).toBeLessThan(0)
  })

  it("scales excitement with positive valence", () => {
    const lowValence = { ...DEFAULT_ANTICIPATION_STATE, level: 0.5, isActive: true, valence: 0.2 }
    const highValence = { ...DEFAULT_ANTICIPATION_STATE, level: 0.5, isActive: true, valence: 0.9 }
    const lowEffect = computeAnticipationEffect(lowValence)
    const highEffect = computeAnticipationEffect(highValence)
    expect(highEffect.excitement).toBeGreaterThan(lowEffect.excitement ?? 0)
  })
})
