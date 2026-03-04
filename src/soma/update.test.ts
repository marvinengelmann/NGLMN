import { describe, expect, it } from "vitest"
import type { EmotionalState } from "@/emotion/types.ts"
import { DEFAULT_SOMATIC_STATE, type SomaticState } from "./types.ts"
import { applySomaticHysteresis, applySomaticMemory, computeSomaticTarget, computeSomaticUpdate } from "./update.ts"

const baseEmotion: EmotionalState = {
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

describe("computeSomaticTarget", () => {
  it("returns default-like values for neutral emotion", () => {
    const target = computeSomaticTarget(baseEmotion)
    for (const val of Object.values(target)) {
      expect(val).toBeGreaterThanOrEqual(0)
      expect(val).toBeLessThanOrEqual(1)
    }
  })

  it("increases tension with high frustration", () => {
    const neutral = computeSomaticTarget(baseEmotion)
    const tense = computeSomaticTarget({ ...baseEmotion, frustration: 1.0 })
    expect(tense.tension).toBeGreaterThan(neutral.tension)
  })

  it("increases warmth with high connection", () => {
    const neutral = computeSomaticTarget(baseEmotion)
    const warm = computeSomaticTarget({ ...baseEmotion, connection: 1.0 })
    expect(warm.warmth).toBeGreaterThan(neutral.warmth)
  })

  it("clamps all values to [0, 1]", () => {
    const extreme: EmotionalState = {
      curiosity: 1,
      satisfaction: 0,
      frustration: 1,
      boredom: 1,
      excitement: 1,
      caution: 1,
      connection: 0,
      confidence: 0,
      energy: 0
    }
    const target = computeSomaticTarget(extreme)
    for (const val of Object.values(target)) {
      expect(val).toBeGreaterThanOrEqual(0)
      expect(val).toBeLessThanOrEqual(1)
    }
  })
})

describe("applySomaticHysteresis", () => {
  it("moves toward target over time", () => {
    const current = DEFAULT_SOMATIC_STATE
    const target: SomaticState = {
      tension: 0.8,
      warmth: 0.8,
      heartRate: 0.8,
      breathing: 0.8,
      gravity: 0.8,
      openness: 0.8
    }
    const result = applySomaticHysteresis(current, target, 60)
    expect(result.tension).toBeGreaterThan(current.tension)
    expect(result.tension).toBeLessThan(target.tension)
  })

  it("has slower half-lives than emotion system", () => {
    const current: SomaticState = { tension: 0, warmth: 0, heartRate: 0, breathing: 0, gravity: 0, openness: 0 }
    const target: SomaticState = { tension: 1, warmth: 1, heartRate: 1, breathing: 1, gravity: 1, openness: 1 }
    const after30min = applySomaticHysteresis(current, target, 30)
    expect(after30min.heartRate).toBeLessThan(0.5)
  })

  it("returns values identical to target for very long elapsed times", () => {
    const current = DEFAULT_SOMATIC_STATE
    const target: SomaticState = {
      tension: 0.9,
      warmth: 0.9,
      heartRate: 0.9,
      breathing: 0.9,
      gravity: 0.9,
      openness: 0.9
    }
    const result = applySomaticHysteresis(current, target, 100000)
    for (const dim of Object.keys(target) as (keyof SomaticState)[]) {
      expect(result[dim]).toBeCloseTo(target[dim], 2)
    }
  })
})

describe("applySomaticMemory", () => {
  it("returns current state when no memories", () => {
    const result = applySomaticMemory(DEFAULT_SOMATIC_STATE, [])
    expect(result).toEqual(DEFAULT_SOMATIC_STATE)
  })

  it("blends toward memory average", () => {
    const memories: SomaticState[] = [
      { tension: 0.8, warmth: 0.8, heartRate: 0.8, breathing: 0.8, gravity: 0.8, openness: 0.8 }
    ]
    const result = applySomaticMemory(DEFAULT_SOMATIC_STATE, memories)
    expect(result.tension).toBeGreaterThan(DEFAULT_SOMATIC_STATE.tension)
    expect(result.tension).toBeLessThan(0.8)
  })
})

describe("computeSomaticUpdate", () => {
  it("produces valid clamped output", () => {
    const result = computeSomaticUpdate(DEFAULT_SOMATIC_STATE, baseEmotion, 10)
    for (const val of Object.values(result)) {
      expect(val).toBeGreaterThanOrEqual(0)
      expect(val).toBeLessThanOrEqual(1)
    }
  })
})
