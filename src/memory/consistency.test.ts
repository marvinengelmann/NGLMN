import { describe, expect, it } from "vitest"

describe("Cross-Memory Consistency", () => {
  const LOW_CONFIDENCE_THRESHOLD = 0.5
  const HIGH_CONFIDENCE_THRESHOLD = 0.7
  const CONFIDENCE_BOOST = 0.05

  const SOURCE_FRESHNESS: Record<string, number> = {
    operator: 4,
    observation: 3,
    reflection: 2,
    dream: 1
  }

  type Resolution =
    | { action: "update_existing" }
    | { action: "keep_existing"; reason: string }
    | { action: "flag_dissonance"; description: string }

  function resolveContradiction(newSource: string, _newConfidence: number, existingConfidence: number): Resolution {
    const newFreshness = SOURCE_FRESHNESS[newSource] ?? 1

    if (newFreshness >= 3 && existingConfidence < LOW_CONFIDENCE_THRESHOLD) {
      return { action: "update_existing" }
    }

    if (existingConfidence > HIGH_CONFIDENCE_THRESHOLD) {
      return {
        action: "keep_existing",
        reason: `Existing entry has high confidence (${existingConfidence.toFixed(2)})`
      }
    }

    return {
      action: "flag_dissonance",
      description: "Value conflict detected"
    }
  }

  describe("resolveContradiction", () => {
    it("should update existing when new source is fresh and existing confidence is low", () => {
      const result = resolveContradiction("observation", 0.7, 0.3)
      expect(result.action).toBe("update_existing")
    })

    it("should update existing when operator source overrides low confidence", () => {
      const result = resolveContradiction("operator", 0.8, 0.4)
      expect(result.action).toBe("update_existing")
    })

    it("should keep existing when confidence is high", () => {
      const result = resolveContradiction("dream", 0.6, 0.8)
      expect(result.action).toBe("keep_existing")
    })

    it("should keep existing even with fresh source if confidence is very high", () => {
      const result = resolveContradiction("operator", 0.9, 0.75)
      expect(result.action).toBe("keep_existing")
    })

    it("should flag dissonance for medium-confidence conflicts", () => {
      const result = resolveContradiction("dream", 0.5, 0.6)
      expect(result.action).toBe("flag_dissonance")
    })

    it("should flag dissonance when dream source meets medium existing confidence", () => {
      const result = resolveContradiction("reflection", 0.6, 0.55)
      expect(result.action).toBe("flag_dissonance")
    })
  })

  describe("severity computation", () => {
    function computeSeverity(
      newValue: string,
      existingValue: string,
      newConfidence: number,
      existingConfidence: number
    ): number {
      const confidenceDiff = Math.abs(newConfidence - existingConfidence)
      const valueDiff = newValue === existingValue ? 0 : 1
      return Math.min(1, valueDiff * 0.6 + confidenceDiff * 0.4)
    }

    it("should return 0 severity for identical values", () => {
      expect(computeSeverity("tea", "tea", 0.5, 0.5)).toBe(0)
    })

    it("should have high severity for different values with same confidence", () => {
      expect(computeSeverity("tea", "coffee", 0.5, 0.5)).toBeCloseTo(0.6)
    })

    it("should cap severity at 1", () => {
      expect(computeSeverity("tea", "coffee", 1.0, 0.0)).toBeLessThanOrEqual(1)
    })

    it("should include confidence difference in severity", () => {
      const lowDiff = computeSeverity("tea", "coffee", 0.5, 0.5)
      const highDiff = computeSeverity("tea", "coffee", 0.9, 0.1)
      expect(highDiff).toBeGreaterThan(lowDiff)
    })
  })

  describe("source freshness", () => {
    it("should rank operator as freshest", () => {
      expect(SOURCE_FRESHNESS.operator ?? 0).toBeGreaterThan(SOURCE_FRESHNESS.observation ?? 0)
    })

    it("should rank dream as least fresh", () => {
      expect(SOURCE_FRESHNESS.dream ?? 0).toBeLessThan(SOURCE_FRESHNESS.reflection ?? 0)
    })
  })

  describe("confidence boost", () => {
    it("should not exceed 1.0 after boost", () => {
      const existing = 0.95
      const boosted = Math.min(1, existing + CONFIDENCE_BOOST)
      expect(boosted).toBe(1)
    })

    it("should apply boost correctly", () => {
      const existing = 0.75
      const boosted = Math.min(1, existing + CONFIDENCE_BOOST)
      expect(boosted).toBeCloseTo(0.8)
    })
  })
})
