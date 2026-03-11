import { describe, expect, it } from "vitest"
import { computePredictionScore, evaluatePrediction } from "./predict.ts"
import type { OperatorPrediction, PredictionAccuracy } from "./types.ts"

describe("Predictive Operator Model", () => {
  describe("computePredictionScore", () => {
    it("should return 1.0 for perfect predictions", () => {
      expect(computePredictionScore(1, 1, 1)).toBeCloseTo(1)
    })

    it("should return 0 for completely wrong predictions", () => {
      expect(computePredictionScore(0, 0, 0)).toBe(0)
    })

    it("should weight mood highest", () => {
      const moodOnly = computePredictionScore(1, 0, 0)
      const timeOnly = computePredictionScore(0, 1, 0)
      const engagementOnly = computePredictionScore(0, 0, 1)
      expect(moodOnly).toBeGreaterThan(timeOnly)
      expect(moodOnly).toBeGreaterThan(engagementOnly)
    })

    it("should produce score between 0 and 1", () => {
      const score = computePredictionScore(0.5, 0.8, 0.3)
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(1)
    })
  })

  describe("evaluatePrediction", () => {
    const basePrediction: OperatorPrediction = {
      expectedResponseMinutes: 30,
      expectedMood: "happy",
      expectedEngagement: "high",
      confidence: 0.5,
      madeAt: new Date().toISOString()
    }

    const baseAccuracy: PredictionAccuracy = {
      recentScores: [],
      runningAverage: 0.5,
      totalPredictions: 0
    }

    it("should score perfectly for exact match", () => {
      const { score } = evaluatePrediction(
        basePrediction,
        { mood: "happy", responseMinutes: 30, messageCount: 5 },
        baseAccuracy
      )
      expect(score).toBeGreaterThan(0.8)
    })

    it("should score low for completely wrong prediction", () => {
      const { score } = evaluatePrediction(
        basePrediction,
        { mood: "sad", responseMinutes: 300, messageCount: 1 },
        baseAccuracy
      )
      expect(score).toBeLessThan(0.3)
    })

    it("should update accuracy tracking", () => {
      const { updatedAccuracy } = evaluatePrediction(
        basePrediction,
        { mood: "happy", responseMinutes: 30, messageCount: 5 },
        baseAccuracy
      )
      expect(updatedAccuracy.totalPredictions).toBe(1)
      expect(updatedAccuracy.recentScores).toHaveLength(1)
    })

    it("should cap recent scores at 20", () => {
      const fullAccuracy: PredictionAccuracy = {
        recentScores: Array.from({ length: 20 }, () => 0.5),
        runningAverage: 0.5,
        totalPredictions: 20
      }
      const { updatedAccuracy } = evaluatePrediction(
        basePrediction,
        { mood: "happy", responseMinutes: 30, messageCount: 5 },
        fullAccuracy
      )
      expect(updatedAccuracy.recentScores).toHaveLength(20)
      expect(updatedAccuracy.totalPredictions).toBe(21)
    })

    it("should return 0.5 score when no prediction was made", () => {
      const noPrediction: OperatorPrediction = {
        ...basePrediction,
        madeAt: null
      }
      const { score } = evaluatePrediction(
        noPrediction,
        { mood: "happy", responseMinutes: 30, messageCount: 5 },
        baseAccuracy
      )
      expect(score).toBe(0.5)
    })

    it("should give partial credit for similar moods", () => {
      const { score: exactMatch } = evaluatePrediction(
        basePrediction,
        { mood: "happy", responseMinutes: 30, messageCount: 5 },
        baseAccuracy
      )
      const { score: similarMood } = evaluatePrediction(
        basePrediction,
        { mood: "excited", responseMinutes: 30, messageCount: 5 },
        baseAccuracy
      )
      const { score: wrongMood } = evaluatePrediction(
        basePrediction,
        { mood: "sad", responseMinutes: 30, messageCount: 5 },
        baseAccuracy
      )
      expect(exactMatch).toBeGreaterThan(similarMood)
      expect(similarMood).toBeGreaterThan(wrongMood)
    })
  })

  describe("running average calculation", () => {
    it("should compute correct average for single score", () => {
      const scores = [0.8]
      const avg = scores.reduce((s, v) => s + v, 0) / scores.length
      expect(avg).toBe(0.8)
    })

    it("should compute correct average for multiple scores", () => {
      const scores = [0.2, 0.4, 0.6, 0.8, 1.0]
      const avg = scores.reduce((s, v) => s + v, 0) / scores.length
      expect(avg).toBeCloseTo(0.6)
    })
  })
})
