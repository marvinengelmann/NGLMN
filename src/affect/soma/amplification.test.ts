import { describe, expect, it } from "vitest"
import type { EmotionalState } from "@/affect/emotion/types.ts"
import { DEFAULT_SOMATIC_STATE } from "./types.ts"
import {
  amplifySomaticPerception,
  computeMisinterpretationTriggers,
  computeSomaticAttentionFocus
} from "./amplification.ts"

const neutralEmotion: EmotionalState = {
  curiosity: 0.5,
  satisfaction: 0.5,
  frustration: 0.5,
  boredom: 0.5,
  excitement: 0.5,
  caution: 0.5,
  connection: 0.5,
  confidence: 0.5,
  energy: 0.5
}

describe("computeSomaticAttentionFocus", () => {
  it("returns low focus for neutral emotion with no idle ticks", () => {
    const focus = computeSomaticAttentionFocus(neutralEmotion, 0)
    expect(focus).toBeLessThan(0.2)
  })

  it("increases with high caution (anxiety)", () => {
    const neutral = computeSomaticAttentionFocus(neutralEmotion, 0)
    const anxious = computeSomaticAttentionFocus({ ...neutralEmotion, caution: 0.9 }, 0)
    expect(anxious).toBeGreaterThan(neutral)
  })

  it("increases with idle ticks (attention wanders inward)", () => {
    const active = computeSomaticAttentionFocus(neutralEmotion, 0)
    const idle = computeSomaticAttentionFocus(neutralEmotion, 10)
    expect(idle).toBeGreaterThan(active)
  })

  it("clamps to [0, 1]", () => {
    const extreme = computeSomaticAttentionFocus({ ...neutralEmotion, caution: 1, energy: 0 }, 20)
    expect(extreme).toBeGreaterThanOrEqual(0)
    expect(extreme).toBeLessThanOrEqual(1)
  })
})

describe("amplifySomaticPerception", () => {
  it("returns actual soma unchanged for very low focus", () => {
    const result = amplifySomaticPerception(DEFAULT_SOMATIC_STATE, 0.05, 0.5)
    expect(result.tension).toBe(DEFAULT_SOMATIC_STATE.tension)
  })

  it("amplifies tension and heart rate with significant focus", () => {
    const elevated = { ...DEFAULT_SOMATIC_STATE, tension: 0.6, heartRate: 0.6 }
    const result = amplifySomaticPerception(elevated, 0.7, 0.5)
    expect(result.tension).toBeGreaterThan(elevated.tension)
    expect(result.heartRate).toBeGreaterThan(elevated.heartRate)
  })

  it("does not modify social battery or immune resilience", () => {
    const result = amplifySomaticPerception(DEFAULT_SOMATIC_STATE, 0.8, 0.5)
    expect(result.socialBattery).toBe(DEFAULT_SOMATIC_STATE.socialBattery)
    expect(result.immuneResilience).toBe(DEFAULT_SOMATIC_STATE.immuneResilience)
  })

  it("clamps all values to [0, 1]", () => {
    const high = { ...DEFAULT_SOMATIC_STATE, tension: 0.95, heartRate: 0.95 }
    const result = amplifySomaticPerception(high, 1.0, 1.0)
    expect(result.tension).toBeLessThanOrEqual(1)
    expect(result.heartRate).toBeLessThanOrEqual(1)
  })
})

describe("computeMisinterpretationTriggers", () => {
  it("returns empty when accuracy is high", () => {
    const perceived = { ...DEFAULT_SOMATIC_STATE, tension: 0.8 }
    const triggers = computeMisinterpretationTriggers(DEFAULT_SOMATIC_STATE, perceived, 0.7, 0.8)
    expect(triggers).toHaveLength(0)
  })

  it("returns empty when attention focus is low", () => {
    const perceived = { ...DEFAULT_SOMATIC_STATE, tension: 0.8 }
    const triggers = computeMisinterpretationTriggers(DEFAULT_SOMATIC_STATE, perceived, 0.2, 0.3)
    expect(triggers).toHaveLength(0)
  })

  it("generates triggers for low accuracy + high focus + perception gap", () => {
    const perceived = { ...DEFAULT_SOMATIC_STATE, tension: 0.7, heartRate: 0.7 }
    const triggers = computeMisinterpretationTriggers(DEFAULT_SOMATIC_STATE, perceived, 0.2, 0.7)
    expect(triggers.length).toBeGreaterThan(0)
    expect(triggers.some((t) => t.detail?.includes("misinterpretation"))).toBe(true)
  })

  it("returns at most 2 triggers", () => {
    const perceived = { ...DEFAULT_SOMATIC_STATE, tension: 1, heartRate: 1 }
    const triggers = computeMisinterpretationTriggers(DEFAULT_SOMATIC_STATE, perceived, 0.1, 0.9)
    expect(triggers.length).toBeLessThanOrEqual(2)
  })
})
