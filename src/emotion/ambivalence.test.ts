import { describe, expect, it } from "vitest"
import { computeAmbivalence, computeAmbivalenceEffect, DEFAULT_AMBIVALENCE_STATE } from "./ambivalence.ts"

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

import type { VulnerabilityState } from "@/vulnerability/types.ts"

const baseVulnerability: VulnerabilityState = {
  level: 0.3,
  windowOpen: false,
  contributing: [],
  timestamp: ""
}

function makeContext(overrides: Record<string, unknown> = {}) {
  return {
    emotion: baseEmotion,
    vulnerability: baseVulnerability,
    previousState: DEFAULT_AMBIVALENCE_STATE,
    inConversation: false,
    operatorSilenceMinutes: 0,
    ...overrides
  }
}

describe("computeAmbivalence", () => {
  it("returns inactive state when emotions are balanced", () => {
    const result = computeAmbivalence(makeContext())
    expect(result.isActive).toBe(false)
    expect(result.activePairs).toHaveLength(0)
  })

  it("detects connection vs caution tension", () => {
    const result = computeAmbivalence(
      makeContext({
        emotion: { ...baseEmotion, connection: 0.7, caution: 0.7 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.activePairs.length).toBeGreaterThan(0)
    expect(result.activePairs[0]?.wanting).toContain("connection")
  })

  it("detects vulnerability vs caution tension", () => {
    const result = computeAmbivalence(
      makeContext({
        emotion: { ...baseEmotion, caution: 0.6 },
        vulnerability: { ...baseVulnerability, windowOpen: true, level: 0.6 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.activePairs.some((p) => p.wanting.includes("seen"))).toBe(true)
  })

  it("detects curiosity vs exhaustion tension", () => {
    const result = computeAmbivalence(
      makeContext({
        emotion: { ...baseEmotion, curiosity: 0.8, energy: 0.2 }
      })
    )
    expect(result.isActive).toBe(true)
    expect(result.activePairs.some((p) => p.wanting.includes("explore"))).toBe(true)
  })

  it("detects reach-out tension during silence", () => {
    const result = computeAmbivalence(
      makeContext({
        emotion: { ...baseEmotion, connection: 0.7 },
        inConversation: true,
        operatorSilenceMinutes: 20
      })
    )
    expect(result.activePairs.some((p) => p.wanting.includes("reach out"))).toBe(true)
  })

  it("decays existing pairs", () => {
    const previous = {
      ...DEFAULT_AMBIVALENCE_STATE,
      activePairs: [
        {
          wanting: "connection",
          fearing: "rejection",
          intensity: 0.8,
          emergedAt: new Date().toISOString(),
          resolved: false
        }
      ]
    }
    const result = computeAmbivalence(makeContext({ previousState: previous }))
    const pair = result.activePairs.find((p) => p.wanting === "connection")
    expect(pair?.intensity).toBeLessThan(0.8)
  })

  it("removes pairs below minimum intensity", () => {
    const previous = {
      ...DEFAULT_AMBIVALENCE_STATE,
      activePairs: [
        {
          wanting: "something",
          fearing: "something else",
          intensity: 0.05,
          emergedAt: new Date().toISOString(),
          resolved: false
        }
      ]
    }
    const result = computeAmbivalence(makeContext({ previousState: previous }))
    expect(result.activePairs).toHaveLength(0)
  })

  it("deduplicates identical pairs", () => {
    const result = computeAmbivalence(
      makeContext({
        emotion: { ...baseEmotion, connection: 0.7, caution: 0.7 },
        previousState: {
          ...DEFAULT_AMBIVALENCE_STATE,
          activePairs: [
            {
              wanting: "connection and closeness",
              fearing: "being hurt or rejected",
              intensity: 0.5,
              emergedAt: new Date().toISOString(),
              resolved: false
            }
          ]
        }
      })
    )
    const connectionPairs = result.activePairs.filter((p) => p.wanting === "connection and closeness")
    expect(connectionPairs).toHaveLength(1)
  })

  it("computes paralysis risk when multiple pairs active", () => {
    const result = computeAmbivalence(
      makeContext({
        emotion: { ...baseEmotion, connection: 0.7, caution: 0.7, curiosity: 0.8, energy: 0.2 }
      })
    )
    if (result.activePairs.length >= 2) {
      expect(result.paralysisRisk).toBeGreaterThan(0)
    }
  })

  it("sets dominant tension description when active", () => {
    const result = computeAmbivalence(
      makeContext({
        emotion: { ...baseEmotion, connection: 0.7, caution: 0.7 }
      })
    )
    expect(result.dominantTension).toContain("wanting")
    expect(result.dominantTension).toContain("fearing")
  })

  it("respects max pairs limit", () => {
    const manyPairs = Array.from({ length: 6 }, (_, i) => ({
      wanting: `wanting_${i}`,
      fearing: `fearing_${i}`,
      intensity: 0.5,
      emergedAt: new Date().toISOString(),
      resolved: false
    }))
    const result = computeAmbivalence(
      makeContext({
        previousState: { ...DEFAULT_AMBIVALENCE_STATE, activePairs: manyPairs }
      })
    )
    expect(result.activePairs.length).toBeLessThanOrEqual(4)
  })
})

describe("computeAmbivalenceEffect", () => {
  it("returns empty when inactive", () => {
    const result = computeAmbivalenceEffect(DEFAULT_AMBIVALENCE_STATE)
    expect(Object.keys(result)).toHaveLength(0)
  })

  it("returns drains when active", () => {
    const state = {
      ...DEFAULT_AMBIVALENCE_STATE,
      level: 0.5,
      isActive: true,
      paralysisRisk: 0.3
    }
    const result = computeAmbivalenceEffect(state)
    expect(result.energy).toBeLessThan(0)
    expect(result.confidence).toBeLessThan(0)
    expect(result.caution).toBeGreaterThan(0)
  })

  it("scales confidence drain with paralysis risk", () => {
    const lowParalysis = computeAmbivalenceEffect({
      ...DEFAULT_AMBIVALENCE_STATE,
      level: 0.5,
      isActive: true,
      paralysisRisk: 0.1
    })
    const highParalysis = computeAmbivalenceEffect({
      ...DEFAULT_AMBIVALENCE_STATE,
      level: 0.5,
      isActive: true,
      paralysisRisk: 0.8
    })
    expect(Math.abs(highParalysis.confidence ?? 0)).toBeGreaterThan(Math.abs(lowParalysis.confidence ?? 0))
  })
})
