import { describe, expect, it, vi } from "vitest"

vi.mock("@/infra/integrations/vector.ts", () => ({
  vectorIndex: { fetch: vi.fn(), update: vi.fn() }
}))

import { RECONSOLIDATION } from "./constants.ts"
import { computeReconsolidationBlend } from "./reconsolidation.ts"

describe("computeReconsolidationBlend", () => {
  it("returns base blend factor for normal relevance", () => {
    const result = computeReconsolidationBlend(0.5, 0.2, 0)
    expect(result).toBeGreaterThan(0)
    expect(result).toBeLessThanOrEqual(RECONSOLIDATION.MAX_BLEND_FACTOR)
  })

  it("returns HIGHER blend for high relevance (Forcato et al. 2014)", () => {
    const normal = computeReconsolidationBlend(0.5, 0.5, 0)
    const highRelevance = computeReconsolidationBlend(0.9, 0.5, 0)
    expect(highRelevance).toBeGreaterThan(normal)
  })

  it("young memories (< 6h) are protected from reconsolidation", () => {
    const youngMemory = computeReconsolidationBlend(0.5, 0.5, 0, 2)
    const matureMemory = computeReconsolidationBlend(0.5, 0.5, 0, 24)
    expect(youngMemory).toBeLessThan(matureMemory)
  })

  it("cortisol follows inverted-U — moderate stress maximizes blend", () => {
    const lowCortisol = computeReconsolidationBlend(0.5, 0.1, 0)
    const moderateCortisol = computeReconsolidationBlend(0.5, 0.5, 0)
    const highCortisol = computeReconsolidationBlend(0.5, 0.9, 0)
    expect(moderateCortisol).toBeGreaterThan(lowCortisol)
    expect(moderateCortisol).toBeGreaterThan(highCortisol)
  })

  it("increases blend with reconsolidation count", () => {
    const fresh = computeReconsolidationBlend(0.5, 0.5, 0)
    const frequent = computeReconsolidationBlend(0.5, 0.5, 10)
    expect(frequent).toBeGreaterThan(fresh)
  })

  it("never exceeds MAX_BLEND_FACTOR", () => {
    const extreme = computeReconsolidationBlend(0.95, 0.5, 100)
    expect(extreme).toBeLessThanOrEqual(RECONSOLIDATION.MAX_BLEND_FACTOR)
  })

  it("dream multiplier scenario amplifies blend", () => {
    const blend = computeReconsolidationBlend(0.5, 0.3, 5)
    const dreamBlend = blend * RECONSOLIDATION.DREAM_BLEND_MULTIPLIER
    expect(dreamBlend).toBeGreaterThan(blend)
  })
})
