import { describe, expect, it } from "vitest"
import {
  computeCyclePosition,
  computeRestDepth,
  computeUltradianModulation,
  determineActivityPhase,
  updateUltradianState
} from "./compute.ts"
import { DEFAULT_ULTRADIAN_STATE } from "./types.ts"

describe("computeCyclePosition", () => {
  it("returns 0 at cycle start", () => {
    const now = new Date()
    expect(computeCyclePosition(now.toISOString(), now, 0.5)).toBeCloseTo(0)
  })

  it("returns ~0.5 at half cycle", () => {
    const start = new Date()
    const halfCycle = new Date(start.getTime() + 45 * 60 * 1000)
    const position = computeCyclePosition(start.toISOString(), halfCycle, 0.5)
    expect(position).toBeGreaterThan(0.4)
    expect(position).toBeLessThan(0.6)
  })

  it("shortens cycle with high cognitive load", () => {
    const start = new Date()
    const midPoint = new Date(start.getTime() + 50 * 60 * 1000)

    const lowLoad = computeCyclePosition(start.toISOString(), midPoint, 0.5, 0.1)
    const highLoad = computeCyclePosition(start.toISOString(), midPoint, 0.5, 0.9)

    expect(highLoad).toBeGreaterThan(lowLoad)
  })

  it("uses default cognitive load of 0.5 when not specified", () => {
    const start = new Date()
    const later = new Date(start.getTime() + 45 * 60 * 1000)

    const withDefault = computeCyclePosition(start.toISOString(), later, 0.5)
    const withExplicit = computeCyclePosition(start.toISOString(), later, 0.5, 0.5)

    expect(withDefault).toBeCloseTo(withExplicit)
  })
})

describe("determineActivityPhase", () => {
  it("returns active for early positions", () => {
    expect(determineActivityPhase(0)).toBe("active")
    expect(determineActivityPhase(0.3)).toBe("active")
  })

  it("returns rest for mid-late positions", () => {
    expect(determineActivityPhase(0.8)).toBe("rest")
  })

  it("returns transitioning_up near end", () => {
    expect(determineActivityPhase(0.95)).toBe("transitioning_up")
  })
})

describe("computeRestDepth", () => {
  it("returns 0 for non-rest phases", () => {
    expect(computeRestDepth(0.3, "active")).toBe(0)
    expect(computeRestDepth(0.65, "transitioning_down")).toBe(0)
  })

  it("returns positive value during rest", () => {
    expect(computeRestDepth(0.8, "rest")).toBeGreaterThan(0)
  })
})

describe("computeUltradianModulation", () => {
  it("boosts attention during active phase", () => {
    const mod = computeUltradianModulation("active", 0)
    expect(mod.attentionModifier).toBeGreaterThan(0)
  })

  it("boosts creativity during rest phase", () => {
    const mod = computeUltradianModulation("rest", 0.8)
    expect(mod.creativityBoost).toBeGreaterThan(0)
    expect(mod.attentionModifier).toBeLessThan(0)
  })
})

describe("updateUltradianState", () => {
  it("starts a new cycle when position reaches 1", () => {
    const twoHoursAgo = new Date(Date.now() - 120 * 60 * 1000).toISOString()
    const oldState = { ...DEFAULT_ULTRADIAN_STATE, cycleStartedAt: twoHoursAgo, cycleCount: 3 }

    const updated = updateUltradianState(oldState, new Date())

    expect(updated.cycleCount).toBe(4)
    expect(updated.phase).toBe("active")
    expect(updated.cyclePosition).toBe(0)
  })

  it("accepts cognitive load parameter", () => {
    const recent = new Date(Date.now() - 50 * 60 * 1000).toISOString()
    const state = { ...DEFAULT_ULTRADIAN_STATE, cycleStartedAt: recent }

    const lowLoad = updateUltradianState(state, new Date(), 0.1)
    const highLoad = updateUltradianState(state, new Date(), 0.9)

    expect(highLoad.cyclePosition).toBeGreaterThan(lowLoad.cyclePosition)
  })
})
