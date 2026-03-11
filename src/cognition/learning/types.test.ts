import { describe, expect, it } from "vitest"
import { computeOutcomeScore, type OperatorReaction } from "./types.ts"

describe("computeOutcomeScore", () => {
  it("should give maximum score for ideal reaction", () => {
    const reaction: OperatorReaction = {
      repliedWithinMinutes: 2,
      sentiment: "positive",
      engagementDelta: 1,
      conversationContinued: true
    }
    const score = computeOutcomeScore(reaction)
    expect(score).toBe(1)
  })

  it("should give zero for worst reaction", () => {
    const reaction: OperatorReaction = {
      repliedWithinMinutes: null,
      sentiment: "negative",
      engagementDelta: -1,
      conversationContinued: false
    }
    const score = computeOutcomeScore(reaction)
    expect(score).toBe(0)
  })

  it("should give partial score for quick reply with neutral sentiment", () => {
    const reaction: OperatorReaction = {
      repliedWithinMinutes: 3,
      sentiment: "neutral",
      engagementDelta: 0,
      conversationContinued: false
    }
    const score = computeOutcomeScore(reaction)
    expect(score).toBeCloseTo(0.3)
  })

  it("should give moderate score for mixed sentiment with continued conversation", () => {
    const reaction: OperatorReaction = {
      repliedWithinMinutes: 15,
      sentiment: "mixed",
      engagementDelta: 0.5,
      conversationContinued: true
    }
    const score = computeOutcomeScore(reaction)
    expect(score).toBeGreaterThan(0.4)
    expect(score).toBeLessThan(0.8)
  })

  it("should handle slow reply correctly", () => {
    const reaction: OperatorReaction = {
      repliedWithinMinutes: 60,
      sentiment: "positive",
      engagementDelta: 0,
      conversationContinued: false
    }
    const score = computeOutcomeScore(reaction)
    expect(score).toBeCloseTo(0.4)
  })

  it("should clamp score between 0 and 1", () => {
    const reaction: OperatorReaction = {
      repliedWithinMinutes: 1,
      sentiment: "positive",
      engagementDelta: 1,
      conversationContinued: true
    }
    expect(computeOutcomeScore(reaction)).toBeLessThanOrEqual(1)

    const badReaction: OperatorReaction = {
      repliedWithinMinutes: null,
      sentiment: "negative",
      engagementDelta: -1,
      conversationContinued: false
    }
    expect(computeOutcomeScore(badReaction)).toBeGreaterThanOrEqual(0)
  })
})
