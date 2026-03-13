import { describe, expect, it } from "vitest"
import type { EmotionalState } from "@/affect/emotion/types.ts"
import { DEFAULT_SOMATIC_STATE, type SomaticState } from "./types.ts"
import {
  applySomaticHysteresis,
  applySomaticMemory,
  circadianFatigue,
  computeSomaticTarget,
  computeSomaticUpdate,
  drainSocialBattery,
  rechargeSocialBattery
} from "./update.ts"

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

const NOON = 12

describe("circadianFatigue", () => {
  it("returns lowest fatigue at peak hour (11:00)", () => {
    const peak = circadianFatigue(11)
    expect(peak).toBeLessThan(0.1)
  })

  it("returns high fatigue late at night (23:00)", () => {
    const night = circadianFatigue(23)
    expect(night).toBeGreaterThan(0.7)
  })

  it("shows post-lunch dip around 14:30", () => {
    const morning = circadianFatigue(10)
    const postLunch = circadianFatigue(14.5)
    expect(postLunch).toBeGreaterThan(morning)
  })

  it("shows evening fatigue higher than afternoon", () => {
    const afternoon = circadianFatigue(15)
    const evening = circadianFatigue(20)
    expect(evening).toBeGreaterThan(afternoon)
  })

  it("clamps output to [0, 1]", () => {
    for (let h = 0; h < 24; h++) {
      const f = circadianFatigue(h)
      expect(f).toBeGreaterThanOrEqual(0)
      expect(f).toBeLessThanOrEqual(1)
    }
  })
})

describe("computeSomaticTarget", () => {
  it("returns default-like values for neutral emotion", () => {
    const target = computeSomaticTarget(baseEmotion, NOON)
    Object.values(target).forEach((value) => {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    })
  })

  it("increases tension with high frustration", () => {
    const neutral = computeSomaticTarget(baseEmotion, NOON)
    const tense = computeSomaticTarget({ ...baseEmotion, frustration: 1.0 }, NOON)
    expect(tense.tension).toBeGreaterThan(neutral.tension)
  })

  it("increases warmth with high connection", () => {
    const neutral = computeSomaticTarget(baseEmotion, NOON)
    const warm = computeSomaticTarget({ ...baseEmotion, connection: 1.0 }, NOON)
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
    const target = computeSomaticTarget(extreme, NOON)
    Object.values(target).forEach((value) => {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    })
  })

  it("produces higher gravity at night than in the morning", () => {
    const morning = computeSomaticTarget(baseEmotion, 10)
    const night = computeSomaticTarget(baseEmotion, 23)
    expect(night.gravity).toBeGreaterThan(morning.gravity)
  })

  it("produces lower heart rate at night than in the morning", () => {
    const morning = computeSomaticTarget(baseEmotion, 10)
    const night = computeSomaticTarget(baseEmotion, 23)
    expect(night.heartRate).toBeLessThan(morning.heartRate)
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
      openness: 0.8,
      socialBattery: 0.8
    }
    const result = applySomaticHysteresis(current, target, 60)
    expect(result.tension).toBeGreaterThan(current.tension)
    expect(result.tension).toBeLessThan(target.tension)
  })

  it("has slower half-lives than emotion system", () => {
    const current: SomaticState = {
      tension: 0,
      warmth: 0,
      heartRate: 0,
      breathing: 0,
      gravity: 0,
      openness: 0,
      socialBattery: 0.8
    }
    const target: SomaticState = {
      tension: 1,
      warmth: 1,
      heartRate: 1,
      breathing: 1,
      gravity: 1,
      openness: 1,
      socialBattery: 0.8
    }
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
      openness: 0.9,
      socialBattery: 0.8
    }
    const result = applySomaticHysteresis(current, target, 100000)
    ;(Object.keys(target) as (keyof SomaticState)[]).forEach((dimension) => {
      expect(result[dimension]).toBeCloseTo(target[dimension], 2)
    })
  })
})

describe("applySomaticMemory", () => {
  it("returns current state when no memories", () => {
    const result = applySomaticMemory(DEFAULT_SOMATIC_STATE, [])
    expect(result).toEqual(DEFAULT_SOMATIC_STATE)
  })

  it("blends toward memory average", () => {
    const memories: SomaticState[] = [
      { tension: 0.8, warmth: 0.8, heartRate: 0.8, breathing: 0.8, gravity: 0.8, openness: 0.8, socialBattery: 0.8 }
    ]
    const result = applySomaticMemory(DEFAULT_SOMATIC_STATE, memories)
    expect(result.tension).toBeGreaterThan(DEFAULT_SOMATIC_STATE.tension)
    expect(result.tension).toBeLessThan(0.8)
  })
})

describe("computeSomaticUpdate", () => {
  it("produces valid clamped output", () => {
    const result = computeSomaticUpdate({
      current: DEFAULT_SOMATIC_STATE,
      emotion: baseEmotion,
      elapsedMinutes: 10,
      hourOfDay: NOON
    })
    Object.values(result).forEach((value) => {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    })
  })
})

describe("drainSocialBattery", () => {
  it("decreases battery on sent messages", () => {
    const result = drainSocialBattery(DEFAULT_SOMATIC_STATE, 3, 0)
    expect(result.socialBattery).toBeLessThan(DEFAULT_SOMATIC_STATE.socialBattery)
  })

  it("decreases battery on received messages", () => {
    const result = drainSocialBattery(DEFAULT_SOMATIC_STATE, 0, 5)
    expect(result.socialBattery).toBeLessThan(DEFAULT_SOMATIC_STATE.socialBattery)
  })

  it("drains more for sent than received messages", () => {
    const sentDrain = drainSocialBattery(DEFAULT_SOMATIC_STATE, 1, 0)
    const receivedDrain = drainSocialBattery(DEFAULT_SOMATIC_STATE, 0, 1)
    const sentDelta = DEFAULT_SOMATIC_STATE.socialBattery - sentDrain.socialBattery
    const receivedDelta = DEFAULT_SOMATIC_STATE.socialBattery - receivedDrain.socialBattery
    expect(sentDelta).toBeGreaterThan(receivedDelta)
  })

  it("clamps battery to minimum 0", () => {
    const lowBattery: SomaticState = { ...DEFAULT_SOMATIC_STATE, socialBattery: 0.01 }
    const result = drainSocialBattery(lowBattery, 10, 10)
    expect(result.socialBattery).toBeGreaterThanOrEqual(0)
  })
})

describe("rechargeSocialBattery", () => {
  it("increases battery during idle", () => {
    const lowBattery: SomaticState = { ...DEFAULT_SOMATIC_STATE, socialBattery: 0.3 }
    const result = rechargeSocialBattery(lowBattery, false)
    expect(result.socialBattery).toBeGreaterThan(0.3)
  })

  it("recharges faster during dream", () => {
    const lowBattery: SomaticState = { ...DEFAULT_SOMATIC_STATE, socialBattery: 0.3 }
    const idleResult = rechargeSocialBattery(lowBattery, false)
    const dreamResult = rechargeSocialBattery(lowBattery, true)
    expect(dreamResult.socialBattery).toBeGreaterThan(idleResult.socialBattery)
  })

  it("clamps battery to maximum 1", () => {
    const highBattery: SomaticState = { ...DEFAULT_SOMATIC_STATE, socialBattery: 0.99 }
    const result = rechargeSocialBattery(highBattery, true)
    expect(result.socialBattery).toBeLessThanOrEqual(1)
  })
})
