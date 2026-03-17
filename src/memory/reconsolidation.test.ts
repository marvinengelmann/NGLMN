import { describe, expect, it } from "vitest"
import { RECONSOLIDATION } from "./constants.ts"

function computeReconsolidationBlend(
  relevanceScore: number,
  cortisolLevel: number,
  reconsolidationCount: number
): number {
  const base =
    relevanceScore >= RECONSOLIDATION.HIGH_RELEVANCE_THRESHOLD
      ? RECONSOLIDATION.HIGH_RELEVANCE_BLEND_FACTOR
      : RECONSOLIDATION.BASE_BLEND_FACTOR

  const cortisolBoost = Math.max(0, cortisolLevel - 0.2) * RECONSOLIDATION.CORTISOL_AMPLIFICATION
  const recountBonus = Math.min(
    RECONSOLIDATION.MAX_RECOUNT_BONUS,
    reconsolidationCount * RECONSOLIDATION.RECOUNT_MALLEABILITY_FACTOR
  )

  return Math.min(RECONSOLIDATION.MAX_BLEND_FACTOR, base + cortisolBoost + recountBonus)
}

describe("computeReconsolidationBlend", () => {
  it("returns base blend factor for normal relevance", () => {
    const result = computeReconsolidationBlend(0.5, 0.2, 0)
    expect(result).toBeCloseTo(RECONSOLIDATION.BASE_BLEND_FACTOR, 2)
  })

  it("returns reduced blend for high relevance", () => {
    const normal = computeReconsolidationBlend(0.5, 0.2, 0)
    const highRelevance = computeReconsolidationBlend(0.9, 0.2, 0)
    expect(highRelevance).toBeLessThan(normal)
  })

  it("increases blend with high cortisol", () => {
    const lowCortisol = computeReconsolidationBlend(0.5, 0.2, 0)
    const highCortisol = computeReconsolidationBlend(0.5, 0.8, 0)
    expect(highCortisol).toBeGreaterThan(lowCortisol)
  })

  it("increases blend with reconsolidation count", () => {
    const fresh = computeReconsolidationBlend(0.5, 0.2, 0)
    const frequent = computeReconsolidationBlend(0.5, 0.2, 10)
    expect(frequent).toBeGreaterThan(fresh)
  })

  it("never exceeds MAX_BLEND_FACTOR", () => {
    const extreme = computeReconsolidationBlend(0.1, 1.0, 100)
    expect(extreme).toBeLessThanOrEqual(RECONSOLIDATION.MAX_BLEND_FACTOR)
  })

  it("recount bonus is capped at MAX_RECOUNT_BONUS", () => {
    const capped = computeReconsolidationBlend(0.5, 0.2, 1000)
    const baseWithMaxRecount = RECONSOLIDATION.BASE_BLEND_FACTOR + RECONSOLIDATION.MAX_RECOUNT_BONUS
    expect(capped).toBeLessThanOrEqual(baseWithMaxRecount + 0.01)
  })

  it("dream multiplier scenario amplifies blend", () => {
    const blend = computeReconsolidationBlend(0.5, 0.3, 5)
    const dreamBlend = blend * RECONSOLIDATION.DREAM_BLEND_MULTIPLIER
    expect(dreamBlend).toBeGreaterThan(blend)
  })
})
