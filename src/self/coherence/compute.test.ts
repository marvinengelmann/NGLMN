import { describe, expect, it } from "vitest"
import { DEFAULT_DRIVE_STATE } from "@/affect/drive/types.ts"
import { makeEmotionalState, makeSomaticState } from "@/test/factories.ts"
import {
  computeCoherence,
  computeCoherenceEffect,
  detectFragmentation,
  shouldRegress,
  updateCoherenceState
} from "./compute.ts"
import { DEFAULT_COHERENCE_STATE } from "./types.ts"

const defaultContext = {
  emotion: makeEmotionalState(),
  soma: makeSomaticState(),
  driveState: DEFAULT_DRIVE_STATE,
  dissonanceScore: 0.1,
  selfConceptAuthenticity: 0.7,
  stressLevel: 0.2
}

describe("detectFragmentation", () => {
  it("should detect emotion-soma mismatch", () => {
    const sources = detectFragmentation({
      ...defaultContext,
      emotion: makeEmotionalState({ excitement: 0.8 }),
      soma: makeSomaticState({ gravity: 0.8 })
    })

    expect(sources).toContain("emotion_soma_mismatch")
  })

  it("should detect drive conflict", () => {
    const sources = detectFragmentation({
      ...defaultContext,
      driveState: { ...DEFAULT_DRIVE_STATE, conflicting: [["curiosity", "connection"]] }
    })

    expect(sources).toContain("drive_conflict")
  })

  it("should detect value-action gap", () => {
    const sources = detectFragmentation({
      ...defaultContext,
      dissonanceScore: 0.7
    })

    expect(sources).toContain("value_action_gap")
  })

  it("should return empty for coherent state", () => {
    const sources = detectFragmentation(defaultContext)
    expect(sources.length).toBe(0)
  })
})

describe("computeCoherence", () => {
  it("should maintain high score when coherent", () => {
    const score = computeCoherence(defaultContext, DEFAULT_COHERENCE_STATE)
    expect(score).toBeGreaterThan(0.6)
  })

  it("should decrease with fragmentation", () => {
    const score = computeCoherence(
      {
        ...defaultContext,
        emotion: makeEmotionalState({ excitement: 0.8 }),
        soma: makeSomaticState({ gravity: 0.8 }),
        dissonanceScore: 0.7
      },
      DEFAULT_COHERENCE_STATE
    )

    expect(score).toBeLessThan(DEFAULT_COHERENCE_STATE.integrationScore)
  })
})

describe("shouldRegress", () => {
  it("should regress under low coherence and high stress", () => {
    expect(shouldRegress(0.2, 0.8)).toBe(true)
  })

  it("should not regress when coherent", () => {
    expect(shouldRegress(0.7, 0.3)).toBe(false)
  })
})

describe("computeCoherenceEffect", () => {
  it("should have no effect when not regressing", () => {
    const effect = computeCoherenceEffect(DEFAULT_COHERENCE_STATE)
    expect(effect.communicationSimplification).toBe(0)
    expect(effect.emotionalDamping).toBe(0)
  })

  it("should simplify communication during regression", () => {
    const effect = computeCoherenceEffect({
      ...DEFAULT_COHERENCE_STATE,
      regressionActive: true,
      regressionDepth: 0.5
    })
    expect(effect.communicationSimplification).toBeGreaterThan(0)
  })
})

describe("updateCoherenceState", () => {
  it("should produce valid state", () => {
    const result = updateCoherenceState(DEFAULT_COHERENCE_STATE, defaultContext)

    expect(result.integrationScore).toBeGreaterThan(0)
    expect(result.regressionActive).toBe(false)
  })
})
