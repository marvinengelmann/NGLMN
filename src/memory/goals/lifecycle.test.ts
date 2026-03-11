import { describe, expect, it } from "vitest"

describe("Goal Priority Decay Math", () => {
  const PRIORITY_DECAY_PER_DAY = 0.01
  const OPERATOR_DECAY_FACTOR = 0.5
  const MIN_PRIORITY = 0.1

  function decayPriority(current: number, isOperator: boolean): number {
    const decayPerTick = PRIORITY_DECAY_PER_DAY / 1440
    const decay = isOperator ? decayPerTick * OPERATOR_DECAY_FACTOR : decayPerTick
    return Math.max(MIN_PRIORITY, current - decay)
  }

  it("should decay self-sourced goal priority per tick", () => {
    const result = decayPriority(0.5, false)
    expect(result).toBeLessThan(0.5)
    expect(result).toBeGreaterThan(0.499)
  })

  it("should decay operator-sourced goals at half rate", () => {
    const selfDecay = 0.5 - decayPriority(0.5, false)
    const operatorDecay = 0.5 - decayPriority(0.5, true)
    expect(operatorDecay).toBeCloseTo(selfDecay * OPERATOR_DECAY_FACTOR)
  })

  it("should not decay below minimum", () => {
    const result = decayPriority(MIN_PRIORITY, false)
    expect(result).toBe(MIN_PRIORITY)
  })

  it("should take ~1440 ticks to decay 0.01 for self goals", () => {
    const priority = Array.from({ length: 1440 }).reduce<number>(
      (p) => decayPriority(p, false),
      0.5
    )
    expect(priority).toBeCloseTo(0.49, 2)
  })
})

describe("Goal Staleness Detection Logic", () => {
  it("should consider goal stale after 14 days without update", () => {
    const staleDays = 14
    const now = new Date()
    const updatedAt = new Date(now.getTime() - staleDays * 24 * 60 * 60 * 1000 - 1)
    const daysSinceUpdate = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24)
    expect(daysSinceUpdate).toBeGreaterThan(staleDays)
  })

  it("should not consider recently updated goal as stale", () => {
    const staleDays = 14
    const now = new Date()
    const updatedAt = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const daysSinceUpdate = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24)
    expect(daysSinceUpdate).toBeLessThan(staleDays)
  })
})

describe("Parent Goal Completion Logic", () => {
  it("should report completion when all children done", () => {
    const children = [{ status: "done" }, { status: "done" }, { status: "done" }]
    const allDone = children.every((c) => c.status === "done")
    expect(allDone).toBe(true)
  })

  it("should report incomplete when any child is not done", () => {
    const children = [{ status: "done" }, { status: "active" }, { status: "done" }]
    const allDone = children.every((c) => c.status === "done")
    expect(allDone).toBe(false)
  })

  it("should report incomplete for empty children", () => {
    const children: { status: string }[] = []
    const allDone = children.length > 0 && children.every((c) => c.status === "done")
    expect(allDone).toBe(false)
  })
})
