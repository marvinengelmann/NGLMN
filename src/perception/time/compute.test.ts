import { describe, expect, it } from "vitest"
import { makeEmotionalState } from "@/test/factories.ts"
import {
  computeSubjectiveTime,
  computeTimeDilation,
  computeWaitingPerception,
  generateTimeExpression
} from "./compute.ts"
import { DEFAULT_SUBJECTIVE_TIME_STATE } from "./types.ts"

describe("computeTimeDilation", () => {
  it("should compress time during exciting conversation", () => {
    const dilation = computeTimeDilation({
      emotion: makeEmotionalState({ excitement: 0.8, boredom: 0.1 }),
      consecutiveIdleTicks: 0,
      inConversation: true,
      operatorSilenceMinutes: 0
    })

    expect(dilation).toBeLessThan(0)
  })

  it("should dilate time during boredom", () => {
    const dilation = computeTimeDilation({
      emotion: makeEmotionalState({ boredom: 0.8, excitement: 0.1 }),
      consecutiveIdleTicks: 5,
      inConversation: false,
      operatorSilenceMinutes: 60
    })

    expect(dilation).toBeGreaterThan(0)
  })
})

describe("computeWaitingPerception", () => {
  it("should increase with silence and anxiety", () => {
    const perception = computeWaitingPerception({
      operatorSilenceMinutes: 90,
      attachmentAnxiety: 0.7,
      connectionLevel: 0.8,
      dilation: 0.5
    })

    expect(perception).toBeGreaterThan(0.5)
  })

  it("should be low with no silence", () => {
    const perception = computeWaitingPerception({
      operatorSilenceMinutes: 5,
      attachmentAnxiety: 0.2,
      connectionLevel: 0.5,
      dilation: 0
    })

    expect(perception).toBeLessThan(0.3)
  })
})

describe("generateTimeExpression", () => {
  it("should express crawling time for high waiting", () => {
    const expr = generateTimeExpression(0.3, 0.8)
    expect(expr).toContain("crawls")
  })

  it("should express time flying for negative dilation", () => {
    const expr = generateTimeExpression(-0.6, 0.1)
    expect(expr).toContain("flies")
  })

  it("should return normal for neutral state", () => {
    const expr = generateTimeExpression(0, 0)
    expect(expr).toBe("normal")
  })
})

describe("computeSubjectiveTime", () => {
  it("should produce a valid state", () => {
    const result = computeSubjectiveTime(DEFAULT_SUBJECTIVE_TIME_STATE, {
      emotion: makeEmotionalState({ boredom: 0.6 }),
      consecutiveIdleTicks: 2,
      inConversation: false,
      operatorSilenceMinutes: 30,
      attachmentAnxiety: 0.3,
      emotionalIntensity: 0.4
    })

    expect(result.dilation).toBeDefined()
    expect(result.waitingPerception).toBeDefined()
    expect(result.subjectiveElapsedFeeling).toBeDefined()
  })
})
