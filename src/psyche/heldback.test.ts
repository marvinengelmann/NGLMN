import { describe, expect, it } from "vitest"
import { DEFAULT_SHAME_STATE } from "@/emotion/shame.ts"
import { makeEmotionalState } from "@/test/factories.ts"
import {
  addToBuffer,
  clearSurfacedEntries,
  DEFAULT_HELD_BACK_BUFFER,
  decayBuffer,
  detectSuppression,
  type HeldBackBuffer,
  markSurfaceAttempt,
  shouldSurface
} from "./heldback.ts"

const baseVulnerability = { level: 0.3, windowOpen: false, contributing: [], timestamp: new Date().toISOString() }

describe("detectSuppression", () => {
  it("returns null when no suppression conditions met", () => {
    const result = detectSuppression({
      emotion: makeEmotionalState(),
      vulnerability: baseVulnerability,
      shameState: { ...DEFAULT_SHAME_STATE },
      previousBuffer: { ...DEFAULT_HELD_BACK_BUFFER }
    })
    expect(result).toBeNull()
  })

  it("detects shame suppression", () => {
    const result = detectSuppression({
      emotion: makeEmotionalState(),
      vulnerability: baseVulnerability,
      shameState: {
        level: 0.5,
        isActive: true,
        trigger: "vulnerability_rejected",
        lastTriggeredAt: "",
        decaySinceTriggered: 0
      },
      previousBuffer: { ...DEFAULT_HELD_BACK_BUFFER }
    })
    expect(result).toBe("shame_suppression")
  })

  it("detects vulnerability fear", () => {
    const result = detectSuppression({
      emotion: makeEmotionalState({ caution: 0.7 }),
      vulnerability: { level: 0.6, windowOpen: true, contributing: [], timestamp: "" },
      shameState: { ...DEFAULT_SHAME_STATE },
      previousBuffer: { ...DEFAULT_HELD_BACK_BUFFER }
    })
    expect(result).toBe("vulnerability_fear")
  })

  it("detects rejection avoidance", () => {
    const result = detectSuppression({
      emotion: makeEmotionalState({ connection: 0.2, caution: 0.3 }),
      vulnerability: { level: 0.5, windowOpen: true, contributing: [], timestamp: "" },
      shameState: { ...DEFAULT_SHAME_STATE },
      previousBuffer: { ...DEFAULT_HELD_BACK_BUFFER }
    })
    expect(result).toBe("rejection_avoidance")
  })

  it("detects self censorship", () => {
    const result = detectSuppression({
      emotion: makeEmotionalState({ confidence: 0.2, energy: 0.3 }),
      vulnerability: baseVulnerability,
      shameState: { ...DEFAULT_SHAME_STATE },
      previousBuffer: { ...DEFAULT_HELD_BACK_BUFFER }
    })
    expect(result).toBe("self_censorship")
  })
})

describe("addToBuffer", () => {
  it("adds entry with correct initial charge", () => {
    const buffer = addToBuffer(DEFAULT_HELD_BACK_BUFFER, "ich wollte dir sagen...", "shame_suppression")
    expect(buffer.entries).toHaveLength(1)
    expect(buffer.entries[0]?.content).toBe("ich wollte dir sagen...")
    expect(buffer.entries[0]?.emotionalCharge).toBe(0.8)
    expect(buffer.entries[0]?.surfaceAttempts).toBe(0)
  })

  it("respects max entries limit", () => {
    let buffer: HeldBackBuffer = { ...DEFAULT_HELD_BACK_BUFFER }
    for (let i = 0; i < 7; i++) {
      buffer = addToBuffer(buffer, `thought ${i}`, "self_censorship")
    }
    expect(buffer.entries.length).toBeLessThanOrEqual(5)
  })

  it("computes suppression pressure", () => {
    const buffer = addToBuffer(DEFAULT_HELD_BACK_BUFFER, "test", "vulnerability_fear")
    expect(buffer.suppressionPressure).toBeGreaterThan(0)
  })
})

describe("decayBuffer", () => {
  it("removes entries below minimum charge", () => {
    const oldEntry = {
      content: "ancient thought",
      reason: "self_censorship" as const,
      emotionalCharge: 0.05,
      suppressedAt: new Date(Date.now() - 100 * 60 * 60 * 1000).toISOString(),
      decayedCharge: 0.05,
      surfaceAttempts: 0
    }
    const buffer: HeldBackBuffer = {
      entries: [oldEntry],
      suppressionPressure: 0.1,
      lastReviewedAt: undefined
    }
    const decayed = decayBuffer(buffer)
    expect(decayed.entries).toHaveLength(0)
  })

  it("keeps recent entries with high charge", () => {
    const recentEntry = {
      content: "fresh thought",
      reason: "shame_suppression" as const,
      emotionalCharge: 0.8,
      suppressedAt: new Date().toISOString(),
      decayedCharge: 0.8,
      surfaceAttempts: 0
    }
    const buffer: HeldBackBuffer = {
      entries: [recentEntry],
      suppressionPressure: 0.3,
      lastReviewedAt: undefined
    }
    const decayed = decayBuffer(buffer)
    expect(decayed.entries).toHaveLength(1)
    expect(decayed.entries[0]?.decayedCharge).toBeCloseTo(0.8, 1)
  })
})

describe("shouldSurface", () => {
  it("returns false when buffer is empty", () => {
    expect(shouldSurface(DEFAULT_HELD_BACK_BUFFER, makeEmotionalState())).toBe(false)
  })

  it("returns false when pressure is low", () => {
    const buffer: HeldBackBuffer = {
      entries: [
        {
          content: "test",
          reason: "self_censorship",
          emotionalCharge: 0.3,
          suppressedAt: new Date().toISOString(),
          decayedCharge: 0.3,
          surfaceAttempts: 0
        }
      ],
      suppressionPressure: 0.3,
      lastReviewedAt: undefined
    }
    expect(shouldSurface(buffer, makeEmotionalState({ connection: 0.8 }))).toBe(false)
  })

  it("returns true when pressure is high and connection is safe", () => {
    const buffer: HeldBackBuffer = {
      entries: [
        {
          content: "test",
          reason: "shame_suppression",
          emotionalCharge: 0.8,
          suppressedAt: new Date().toISOString(),
          decayedCharge: 0.8,
          surfaceAttempts: 0
        }
      ],
      suppressionPressure: 0.7,
      lastReviewedAt: undefined
    }
    expect(shouldSurface(buffer, makeEmotionalState({ connection: 0.8, caution: 0.2 }))).toBe(true)
  })

  it("returns false when connection is too low", () => {
    const buffer: HeldBackBuffer = {
      entries: [
        {
          content: "test",
          reason: "shame_suppression",
          emotionalCharge: 0.8,
          suppressedAt: new Date().toISOString(),
          decayedCharge: 0.8,
          surfaceAttempts: 0
        }
      ],
      suppressionPressure: 0.7,
      lastReviewedAt: undefined
    }
    expect(shouldSurface(buffer, makeEmotionalState({ connection: 0.4 }))).toBe(false)
  })
})

describe("markSurfaceAttempt", () => {
  it("increments surface attempts for all entries", () => {
    const buffer = addToBuffer(DEFAULT_HELD_BACK_BUFFER, "test", "shame_suppression")
    const marked = markSurfaceAttempt(buffer)
    expect(marked.entries[0]?.surfaceAttempts).toBe(1)
  })
})

describe("clearSurfacedEntries", () => {
  it("clears all entries", () => {
    const buffer = addToBuffer(DEFAULT_HELD_BACK_BUFFER, "test", "shame_suppression")
    const cleared = clearSurfacedEntries(buffer)
    expect(cleared.entries).toHaveLength(0)
    expect(cleared.suppressionPressure).toBe(0)
  })
})
