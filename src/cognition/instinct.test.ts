import { describe, expect, it } from "vitest"
import { detectCognitiveConflict, shouldInstinctOverride } from "./override.ts"
import type { InstinctImpression } from "./types.ts"

const baseSoma = {
  tension: 0.5,
  warmth: 0.5,
  heartRate: 0.5,
  breathing: 0.5,
  gravity: 0.5,
  openness: 0.5
}

const neutralImpression: InstinctImpression = {
  impulse: "neutral",
  confidence: 0.5,
  basis: "test",
  episodicMatches: 3,
  emotionalCharge: 0.3
}

describe("shouldInstinctOverride", () => {
  it("returns false for neutral impression with neutral soma", () => {
    expect(shouldInstinctOverride(neutralImpression, baseSoma)).toBe(false)
  })

  it("returns true for extreme emotional charge + high confidence + high tension", () => {
    const extreme: InstinctImpression = {
      impulse: "avoid",
      confidence: 0.8,
      basis: "danger",
      episodicMatches: 5,
      emotionalCharge: 0.9
    }
    expect(shouldInstinctOverride(extreme, { ...baseSoma, tension: 0.8 })).toBe(true)
  })

  it("returns true for avoid impulse with high heart rate", () => {
    const avoidImpression: InstinctImpression = {
      impulse: "avoid",
      confidence: 0.5,
      basis: "test",
      episodicMatches: 2,
      emotionalCharge: 0.5
    }
    expect(shouldInstinctOverride(avoidImpression, { ...baseSoma, heartRate: 0.9 })).toBe(true)
  })
})

describe("detectCognitiveConflict", () => {
  it("detects no conflict when instinct is neutral", () => {
    const result = detectCognitiveConflict(neutralImpression, "idle")
    expect(result.detected).toBe(false)
  })

  it("detects conflict when instinct says engage but reason says idle", () => {
    const engageImpression: InstinctImpression = {
      impulse: "engage",
      confidence: 0.7,
      basis: "positive memory",
      episodicMatches: 4,
      emotionalCharge: 0.6
    }
    const result = detectCognitiveConflict(engageImpression, "idle")
    expect(result.detected).toBe(true)
    expect(result.tensionLevel).toBeGreaterThan(0)
  })

  it("has correct instinct/reason labels", () => {
    const result = detectCognitiveConflict(neutralImpression, "reflect")
    expect(result.instinctImpulse).toBe("neutral")
    expect(result.reasonDecision).toBe("reflect")
  })
})
