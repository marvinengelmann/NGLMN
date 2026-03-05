import { describe, expect, it } from "vitest"
import { computeDistortionProbability } from "./compute.ts"

describe("computeDistortionProbability", () => {
  it("returns base probability for zero-age, mid-relevance, zero-emotion", () => {
    const prob = computeDistortionProbability({
      memoryAgeDays: 0,
      relevanceScore: 0.5,
      emotionalIntensity: 0
    })
    expect(prob).toBeGreaterThan(0)
    expect(prob).toBeLessThan(1)
  })

  it("increases with memory age", () => {
    const young = computeDistortionProbability({
      memoryAgeDays: 1,
      relevanceScore: 0.5,
      emotionalIntensity: 0
    })
    const old = computeDistortionProbability({
      memoryAgeDays: 60,
      relevanceScore: 0.5,
      emotionalIntensity: 0
    })
    expect(old).toBeGreaterThan(young)
  })

  it("increases with lower relevance", () => {
    const relevant = computeDistortionProbability({
      memoryAgeDays: 10,
      relevanceScore: 0.9,
      emotionalIntensity: 0
    })
    const irrelevant = computeDistortionProbability({
      memoryAgeDays: 10,
      relevanceScore: 0.1,
      emotionalIntensity: 0
    })
    expect(irrelevant).toBeGreaterThan(relevant)
  })

  it("increases with emotional intensity", () => {
    const calm = computeDistortionProbability({
      memoryAgeDays: 10,
      relevanceScore: 0.5,
      emotionalIntensity: 0
    })
    const intense = computeDistortionProbability({
      memoryAgeDays: 10,
      relevanceScore: 0.5,
      emotionalIntensity: 1
    })
    expect(intense).toBeGreaterThan(calm)
  })

  it("clamps to [0, 1]", () => {
    const maxProb = computeDistortionProbability({
      memoryAgeDays: 1000,
      relevanceScore: 0,
      emotionalIntensity: 1
    })
    expect(maxProb).toBeLessThanOrEqual(1)
    expect(maxProb).toBeGreaterThanOrEqual(0)
  })
})
