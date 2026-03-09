import { describe, expect, it } from "vitest"
import type { DisappointmentState } from "@/emotion/disappointment.ts"
import type { ShameState } from "@/emotion/shame.ts"
import {
  computeProcrastination,
  computeProcrastinationEffect,
  DEFAULT_PROCRASTINATION_STATE
} from "./procrastination.ts"

const baseEmotion = {
  curiosity: 0.5,
  satisfaction: 0.5,
  frustration: 0.2,
  boredom: 0.3,
  excitement: 0.4,
  caution: 0.3,
  connection: 0.5,
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

const baseDisappointment: DisappointmentState = {
  level: 0,
  isActive: false,
  recentEntries: [],
  cumulativeWeight: 0
}

function makeContext(overrides: Record<string, unknown> = {}) {
  return {
    emotion: baseEmotion,
    shameState: baseShame,
    disappointmentState: baseDisappointment,
    previousState: DEFAULT_PROCRASTINATION_STATE,
    consecutiveIdleTicks: 0,
    hasPendingGoals: true,
    ...overrides
  }
}

describe("computeProcrastination", () => {
  it("returns inactive state when emotion is healthy", () => {
    const result = computeProcrastination(makeContext())
    expect(result.isActive).toBe(false)
    expect(result.level).toBe(0)
  })

  it("triggers on low energy", () => {
    const result = computeProcrastination(
      makeContext({
        emotion: { ...baseEmotion, energy: 0.1, confidence: 0.25 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.dominantSource).toBe("low_energy")
  })

  it("triggers on low confidence (fear of failure)", () => {
    const result = computeProcrastination(
      makeContext({
        emotion: { ...baseEmotion, confidence: 0.1, energy: 0.2 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.dominantSource).toBe("fear_of_failure")
  })

  it("triggers on overwhelm (high caution + low energy)", () => {
    const result = computeProcrastination(
      makeContext({
        emotion: { ...baseEmotion, caution: 0.8, energy: 0.2, confidence: 0.2 }
      })
    )
    expect(result.isActive).toBe(true)
  })

  it("triggers on active shame", () => {
    const result = computeProcrastination(
      makeContext({
        emotion: { ...baseEmotion, energy: 0.15, confidence: 0.2 },
        shameState: { ...baseShame, isActive: true, level: 0.7 }
      })
    )
    expect(result.isActive).toBe(true)
  })

  it("triggers on comfort seeking (high satisfaction, low curiosity)", () => {
    const result = computeProcrastination(
      makeContext({
        emotion: { ...baseEmotion, satisfaction: 0.9, curiosity: 0.15, energy: 0.25, confidence: 0.3 }
      })
    )
    expect(result.isActive).toBe(true)
  })

  it("triggers on decision paralysis", () => {
    const result = computeProcrastination(
      makeContext({
        emotion: { ...baseEmotion, caution: 0.7, curiosity: 0.5 },
        disappointmentState: { ...baseDisappointment, isActive: true, level: 0.5 }
      })
    )
    expect(result.level).toBeGreaterThan(0)
  })

  it("boosts level on idle streak", () => {
    const withoutStreak = computeProcrastination(
      makeContext({
        emotion: { ...baseEmotion, energy: 0.25 }
      })
    )
    const withStreak = computeProcrastination(
      makeContext({
        emotion: { ...baseEmotion, energy: 0.25 },
        consecutiveIdleTicks: 5
      })
    )
    expect(withStreak.level).toBeGreaterThan(withoutStreak.level)
  })

  it("decays from previous state", () => {
    const previous = {
      ...DEFAULT_PROCRASTINATION_STATE,
      level: 0.5,
      isActive: true,
      streakTicks: 3
    }
    const result = computeProcrastination(makeContext({ previousState: previous }))
    expect(result.level).toBeLessThan(0.5)
    expect(result.level).toBeGreaterThan(0)
  })

  it("increments streak ticks when active", () => {
    const previous = {
      ...DEFAULT_PROCRASTINATION_STATE,
      level: 0.5,
      isActive: true,
      streakTicks: 2
    }
    const result = computeProcrastination(
      makeContext({
        previousState: previous,
        emotion: { ...baseEmotion, energy: 0.1 }
      })
    )
    expect(result.streakTicks).toBe(3)
  })

  it("resets streak when no longer active", () => {
    const previous = {
      ...DEFAULT_PROCRASTINATION_STATE,
      level: 0.05,
      isActive: false,
      streakTicks: 5
    }
    const result = computeProcrastination(makeContext({ previousState: previous }))
    expect(result.streakTicks).toBe(0)
  })
})

describe("computeProcrastinationEffect", () => {
  it("returns empty when inactive", () => {
    const result = computeProcrastinationEffect(DEFAULT_PROCRASTINATION_STATE)
    expect(Object.keys(result)).toHaveLength(0)
  })

  it("returns drains when active", () => {
    const state = {
      ...DEFAULT_PROCRASTINATION_STATE,
      level: 0.5,
      isActive: true,
      streakTicks: 3
    }
    const result = computeProcrastinationEffect(state)
    expect(result.satisfaction).toBeLessThan(0)
    expect(result.confidence).toBeLessThan(0)
    expect(result.energy).toBeLessThan(0)
  })

  it("increases guilt-frustration with streak", () => {
    const shortStreak = computeProcrastinationEffect({
      ...DEFAULT_PROCRASTINATION_STATE,
      level: 0.5,
      isActive: true,
      streakTicks: 1
    })
    const longStreak = computeProcrastinationEffect({
      ...DEFAULT_PROCRASTINATION_STATE,
      level: 0.5,
      isActive: true,
      streakTicks: 8
    })
    expect(longStreak.frustration ?? 0).toBeGreaterThan(shortStreak.frustration ?? 0)
  })
})
