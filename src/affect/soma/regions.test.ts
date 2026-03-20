import { describe, expect, it } from "vitest"
import type { EmotionalState } from "@/affect/emotion/types.ts"
import { applyRegionalHysteresis, computeRegionalTarget } from "./regions.ts"
import { BODY_REGIONS, type BodyRegionMap, DEFAULT_BODY_REGION_MAP } from "./types.ts"

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

const NOON = 12

describe("computeRegionalTarget", () => {
  it("returns baselines for neutral emotion", () => {
    const target = computeRegionalTarget(neutralEmotion, NOON)
    for (const region of BODY_REGIONS) {
      expect(target[region]).toBeGreaterThanOrEqual(0)
      expect(target[region]).toBeLessThanOrEqual(1)
    }
  })

  it("activates gut and shoulders with high frustration", () => {
    const neutral = computeRegionalTarget(neutralEmotion, NOON)
    const frustrated = computeRegionalTarget({ ...neutralEmotion, frustration: 1.0 }, NOON)
    expect(frustrated.gut).toBeGreaterThan(neutral.gut)
    expect(frustrated.shoulders).toBeGreaterThan(neutral.shoulders)
    expect(frustrated.chest).toBeGreaterThan(neutral.chest)
  })

  it("activates chest and throat with high caution (anxiety)", () => {
    const neutral = computeRegionalTarget(neutralEmotion, NOON)
    const anxious = computeRegionalTarget({ ...neutralEmotion, caution: 1.0 }, NOON)
    expect(anxious.chest).toBeGreaterThan(neutral.chest)
    expect(anxious.throat).toBeGreaterThan(neutral.throat)
    expect(anxious.gut).toBeGreaterThan(neutral.gut)
  })

  it("activates chest and skin with high connection (warmth)", () => {
    const neutral = computeRegionalTarget(neutralEmotion, NOON)
    const warm = computeRegionalTarget({ ...neutralEmotion, connection: 1.0 }, NOON)
    expect(warm.chest).toBeGreaterThan(neutral.chest)
    expect(warm.skin).toBeGreaterThan(neutral.skin)
  })

  it("activates chest and limbs with high excitement", () => {
    const neutral = computeRegionalTarget(neutralEmotion, NOON)
    const excited = computeRegionalTarget({ ...neutralEmotion, excitement: 1.0 }, NOON)
    expect(excited.chest).toBeGreaterThan(neutral.chest)
    expect(excited.limbs).toBeGreaterThan(neutral.limbs)
  })

  it("activates head with high curiosity", () => {
    const neutral = computeRegionalTarget(neutralEmotion, NOON)
    const curious = computeRegionalTarget({ ...neutralEmotion, curiosity: 1.0 }, NOON)
    expect(curious.head).toBeGreaterThan(neutral.head)
  })

  it("relaxes shoulders with high satisfaction", () => {
    const neutral = computeRegionalTarget(neutralEmotion, NOON)
    const satisfied = computeRegionalTarget({ ...neutralEmotion, satisfaction: 1.0 }, NOON)
    expect(satisfied.shoulders).toBeLessThan(neutral.shoulders)
  })

  it("fatigue increases head and limb activation at night", () => {
    const morning = computeRegionalTarget(neutralEmotion, 10)
    const night = computeRegionalTarget(neutralEmotion, 23)
    expect(night.head).toBeGreaterThan(morning.head)
    expect(night.limbs).toBeGreaterThan(morning.limbs)
  })

  it("clamps all regions to [0, 1] even with extreme emotions", () => {
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
    const target = computeRegionalTarget(extreme, NOON)
    for (const region of BODY_REGIONS) {
      expect(target[region]).toBeGreaterThanOrEqual(0)
      expect(target[region]).toBeLessThanOrEqual(1)
    }
  })

  it("differentiates frustration from anxiety body patterns", () => {
    const frustrated = computeRegionalTarget({ ...neutralEmotion, frustration: 0.9 }, NOON)
    const anxious = computeRegionalTarget({ ...neutralEmotion, caution: 0.9 }, NOON)
    expect(frustrated.gut).toBeGreaterThan(anxious.gut)
    expect(anxious.throat).toBeGreaterThan(frustrated.throat)
  })
})

describe("applyRegionalHysteresis", () => {
  it("moves toward target over time", () => {
    const current = DEFAULT_BODY_REGION_MAP
    const target: BodyRegionMap = {
      head: 0.8,
      chest: 0.8,
      gut: 0.8,
      throat: 0.8,
      shoulders: 0.8,
      skin: 0.8,
      limbs: 0.8
    }
    const result = applyRegionalHysteresis(current, target, 60)
    for (const region of BODY_REGIONS) {
      expect(result[region]).toBeGreaterThan(current[region])
      expect(result[region]).toBeLessThan(target[region])
    }
  })

  it("gut tension lingers longer than throat constriction", () => {
    const elevated: BodyRegionMap = {
      head: 0.8,
      chest: 0.8,
      gut: 0.8,
      throat: 0.8,
      shoulders: 0.8,
      skin: 0.8,
      limbs: 0.8
    }
    const target = DEFAULT_BODY_REGION_MAP
    const after60min = applyRegionalHysteresis(elevated, target, 60)
    const gutRemaining = after60min.gut - target.gut
    const throatRemaining = after60min.throat - target.throat
    expect(gutRemaining).toBeGreaterThan(throatRemaining)
  })

  it("shoulders are very persistent (longest half-life)", () => {
    const elevated: BodyRegionMap = {
      head: 0.8,
      chest: 0.8,
      gut: 0.8,
      throat: 0.8,
      shoulders: 0.8,
      skin: 0.8,
      limbs: 0.8
    }
    const target = DEFAULT_BODY_REGION_MAP
    const after120min = applyRegionalHysteresis(elevated, target, 120)
    const shoulderRemaining = after120min.shoulders - target.shoulders
    const headRemaining = after120min.head - target.head
    expect(shoulderRemaining).toBeGreaterThan(headRemaining)
  })

  it("converges to target after very long time", () => {
    const elevated: BodyRegionMap = {
      head: 1,
      chest: 1,
      gut: 1,
      throat: 1,
      shoulders: 1,
      skin: 1,
      limbs: 1
    }
    const target = DEFAULT_BODY_REGION_MAP
    const result = applyRegionalHysteresis(elevated, target, 100000)
    for (const region of BODY_REGIONS) {
      expect(result[region]).toBeCloseTo(target[region], 2)
    }
  })

  it("clamps all values to [0, 1]", () => {
    const result = applyRegionalHysteresis(DEFAULT_BODY_REGION_MAP, DEFAULT_BODY_REGION_MAP, 10)
    for (const region of BODY_REGIONS) {
      expect(result[region]).toBeGreaterThanOrEqual(0)
      expect(result[region]).toBeLessThanOrEqual(1)
    }
  })
})
