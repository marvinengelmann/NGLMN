import { describe, expect, it } from "vitest"
import { BODY_REGIONS, type BodyRegionMap, DEFAULT_BODY_REGION_MAP } from "./types.ts"
import { applySensitizationAmplification, updateSensitization } from "./sensitization.ts"

const zeroProfile: BodyRegionMap = { head: 0, chest: 0, gut: 0, throat: 0, shoulders: 0, skin: 0, limbs: 0 }

describe("updateSensitization", () => {
  it("returns zeros when all activations are below threshold", () => {
    const result = updateSensitization(zeroProfile, DEFAULT_BODY_REGION_MAP, 10)
    for (const region of BODY_REGIONS) {
      expect(result[region]).toBe(0)
    }
  })

  it("accumulates sensitization for activations above threshold", () => {
    const highActivation: BodyRegionMap = {
      head: 0.2, chest: 0.6, gut: 0.7, throat: 0.2, shoulders: 0.5, skin: 0.2, limbs: 0.2
    }
    const result = updateSensitization(zeroProfile, highActivation, 10)
    expect(result.gut).toBeGreaterThan(0)
    expect(result.chest).toBeGreaterThan(0)
    expect(result.shoulders).toBeGreaterThan(0)
    expect(result.head).toBe(0)
  })

  it("decays existing sensitization over time", () => {
    const elevated: BodyRegionMap = { head: 0.5, chest: 0.5, gut: 0.5, throat: 0.5, shoulders: 0.5, skin: 0.5, limbs: 0.5 }
    const decayed = updateSensitization(elevated, zeroProfile, 60)
    for (const region of BODY_REGIONS) {
      expect(decayed[region]).toBeLessThan(0.5)
      expect(decayed[region]).toBeGreaterThan(0)
    }
  })

  it("clamps all values to [0, 1]", () => {
    const maxActivation: BodyRegionMap = { head: 1, chest: 1, gut: 1, throat: 1, shoulders: 1, skin: 1, limbs: 1 }
    const result = updateSensitization(maxActivation, maxActivation, 10)
    for (const region of BODY_REGIONS) {
      expect(result[region]).toBeLessThanOrEqual(1)
      expect(result[region]).toBeGreaterThanOrEqual(0)
    }
  })
})

describe("applySensitizationAmplification", () => {
  it("returns unchanged targets when sensitization is below effect threshold", () => {
    const lowSensitization: BodyRegionMap = {
      head: 0.05, chest: 0.05, gut: 0.05, throat: 0.05, shoulders: 0.05, skin: 0.05, limbs: 0.05
    }
    const result = applySensitizationAmplification(DEFAULT_BODY_REGION_MAP, lowSensitization)
    for (const region of BODY_REGIONS) {
      expect(result[region]).toBe(DEFAULT_BODY_REGION_MAP[region])
    }
  })

  it("amplifies targets proportional to sensitization level", () => {
    const highSensitization: BodyRegionMap = {
      head: 0.5, chest: 0.5, gut: 0.5, throat: 0.5, shoulders: 0.5, skin: 0.5, limbs: 0.5
    }
    const result = applySensitizationAmplification(DEFAULT_BODY_REGION_MAP, highSensitization)
    for (const region of BODY_REGIONS) {
      expect(result[region]).toBeGreaterThan(DEFAULT_BODY_REGION_MAP[region])
    }
  })

  it("clamps amplified values to [0, 1]", () => {
    const maxSensitization: BodyRegionMap = { head: 1, chest: 1, gut: 1, throat: 1, shoulders: 1, skin: 1, limbs: 1 }
    const highTarget: BodyRegionMap = { head: 0.9, chest: 0.9, gut: 0.9, throat: 0.9, shoulders: 0.9, skin: 0.9, limbs: 0.9 }
    const result = applySensitizationAmplification(highTarget, maxSensitization)
    for (const region of BODY_REGIONS) {
      expect(result[region]).toBeLessThanOrEqual(1)
    }
  })
})
