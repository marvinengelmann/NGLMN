import { describe, expect, it } from "vitest"
import { makeEmotionalState, makeSomaticState } from "@/test/factories.ts"
import {
  computeCognitiveClarity,
  computeCognitiveFatigue,
  computeMetacognitiveModifiers,
  detectRumination,
  updateMetacognitiveState
} from "./metacognition.ts"
import { DEFAULT_METACOGNITIVE_STATE } from "./types.ts"

describe("computeCognitiveClarity", () => {
  it("should be high when calm and coherent", () => {
    const clarity = computeCognitiveClarity({
      emotion: makeEmotionalState({ frustration: 0.1, excitement: 0.2 }),
      soma: makeSomaticState({ tension: 0.1 }),
      fatigue: 0.1,
      coherenceScore: 0.8
    })

    expect(clarity).toBeGreaterThan(0.6)
  })

  it("should decrease with high frustration and tension", () => {
    const clarity = computeCognitiveClarity({
      emotion: makeEmotionalState({ frustration: 0.8 }),
      soma: makeSomaticState({ tension: 0.8 }),
      fatigue: 0.7,
      coherenceScore: 0.3
    })

    expect(clarity).toBeLessThan(0.5)
  })
})

describe("detectRumination", () => {
  it("should detect repeated reasoning themes", () => {
    const reasonings = [
      "thinking about whether I should respond to the silence",
      "still thinking about the silence and whether I should respond",
      "the silence makes me wonder if I should respond"
    ]

    const result = detectRumination(reasonings, DEFAULT_METACOGNITIVE_STATE)
    expect(result.detected).toBe(true)
  })

  it("should not detect rumination with diverse topics", () => {
    const reasonings = ["processing a new message about cooking", "reflecting on a dream about flying"]

    const result = detectRumination(reasonings, DEFAULT_METACOGNITIVE_STATE)
    expect(result.detected).toBe(false)
  })
})

describe("computeCognitiveFatigue", () => {
  it("should increase with complex decisions", () => {
    const fatigue = computeCognitiveFatigue(0.2, true, false)
    expect(fatigue).toBeGreaterThan(0.2)
  })

  it("should reset during dreaming", () => {
    const fatigue = computeCognitiveFatigue(0.6, false, true)
    expect(fatigue).toBeLessThan(0.6)
  })

  it("should decay naturally", () => {
    const fatigue = computeCognitiveFatigue(0.5, false, false)
    expect(fatigue).toBeLessThan(0.5)
  })
})

describe("computeMetacognitiveModifiers", () => {
  it("should increase hedging when fatigued", () => {
    const result = computeMetacognitiveModifiers({
      ...DEFAULT_METACOGNITIVE_STATE,
      cognitiveFatigue: 0.8
    })
    expect(result.hedgingLevel).toBeGreaterThan(0)
  })

  it("should reduce confidence during rumination", () => {
    const result = computeMetacognitiveModifiers({
      ...DEFAULT_METACOGNITIVE_STATE,
      ruminationDetected: true
    })
    expect(result.confidenceModifier).toBeLessThan(0)
  })
})

describe("updateMetacognitiveState", () => {
  it("should produce valid state", () => {
    const result = updateMetacognitiveState(DEFAULT_METACOGNITIVE_STATE, {
      emotion: makeEmotionalState(),
      soma: makeSomaticState(),
      coherenceScore: 0.7,
      recentReasonings: ["thinking about things"],
      isComplexDecision: false,
      isDreaming: false
    })

    expect(result.cognitiveClarity).toBeGreaterThan(0)
    expect(result.cognitiveFatigue).toBeGreaterThanOrEqual(0)
  })
})
