import { describe, expect, it } from "vitest"
import {
  decayHabitStrength,
  detectHabitPatterns,
  findAutomaticHabit,
  strengthenHabit,
  updateHabitState
} from "./habit.ts"
import { DEFAULT_HABIT_STATE, type Habit } from "./types.ts"

function makeHabit(overrides?: Partial<Habit>): Habit {
  return {
    id: "habit-1",
    pattern: "reflect",
    type: "emotional",
    strength: 0.5,
    repetitions: 5,
    lastActivatedAt: "2026-03-06T12:00:00Z",
    isAutomatic: false,
    ...overrides
  }
}

describe("detectHabitPatterns", () => {
  it("should detect repeated action patterns", () => {
    const actions = ["reflect", "reflect", "reflect", "idle", "idle"]
    const result = detectHabitPatterns(actions, [])

    expect(result).not.toBeNull()
    expect(result?.pattern).toBe("reflect")
  })

  it("should not detect patterns below threshold", () => {
    const actions = ["reflect", "idle"]
    const result = detectHabitPatterns(actions, [])

    expect(result).toBeNull()
  })

  it("should skip existing habits", () => {
    const existing = [makeHabit({ pattern: "reflect" })]
    const actions = ["reflect", "reflect", "reflect"]
    const result = detectHabitPatterns(actions, existing)

    expect(result).toBeNull()
  })
})

describe("strengthenHabit", () => {
  it("should increase strength and repetitions", () => {
    const habit = makeHabit({ strength: 0.5 })
    const result = strengthenHabit(habit)

    expect(result.strength).toBeGreaterThan(0.5)
    expect(result.repetitions).toBe(6)
  })

  it("should mark as automatic when strength is high enough", () => {
    const habit = makeHabit({ strength: 0.75 })
    const result = strengthenHabit(habit)

    expect(result.isAutomatic).toBe(true)
  })
})

describe("decayHabitStrength", () => {
  it("should reduce strength over time", () => {
    const habit = makeHabit({ strength: 0.5 })
    const result = decayHabitStrength(habit)

    expect(result.strength).toBeLessThan(0.5)
  })
})

describe("findAutomaticHabit", () => {
  it("should find a matching automatic habit", () => {
    const habits = [makeHabit({ strength: 0.9, isAutomatic: true })]
    const result = findAutomaticHabit(habits, "time to reflect on things")

    expect(result).not.toBeNull()
  })

  it("should return null when no automatic habit matches", () => {
    const habits = [makeHabit({ strength: 0.3 })]
    const result = findAutomaticHabit(habits, "reflect")

    expect(result).toBeNull()
  })
})

describe("updateHabitState", () => {
  it("should strengthen existing habits on match", () => {
    const state = { ...DEFAULT_HABIT_STATE, habits: [makeHabit()] }
    const result = updateHabitState(state, ["reflect", "reflect", "reflect"], "reflect")

    const habit = result.habits.find((h) => h.pattern === "reflect")
    expect(habit?.repetitions).toBeGreaterThan(5)
  })
})
