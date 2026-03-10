import { describe, expect, it } from "vitest"
import {
  buildExpectations,
  checkExpectationViolations,
  computeAnticipationEmotionTriggers,
  updateAnticipatoryState
} from "./compute.ts"
import { DEFAULT_ANTICIPATORY_STATE, type Expectation } from "./types.ts"

describe("buildExpectations", () => {
  it("should create conversation expectation when in conversation", () => {
    const expectations = buildExpectations({
      inConversation: true,
      operatorSilenceMinutes: 0,
      connectionLevel: 0.7,

      hasCalendarEvents: false
    })

    expect(expectations.length).toBeGreaterThan(0)
    expect(expectations[0]?.source).toBe("conversation")
  })

  it("should create return expectation during moderate silence", () => {
    const expectations = buildExpectations({
      inConversation: false,
      operatorSilenceMinutes: 60,
      connectionLevel: 0.6,

      hasCalendarEvents: false
    })

    const returnExp = expectations.find((e) => e.content.includes("return"))
    expect(returnExp).toBeDefined()
  })
})

describe("checkExpectationViolations", () => {
  it("should detect conversation end violation", () => {
    const expectations: Expectation[] = [
      {
        content: "operator will continue engaging",
        source: "conversation",
        confidence: 0.7,
        expectedAt: null,
        valence: 0.5
      }
    ]

    const violations = checkExpectationViolations(expectations, false, 0, false)
    expect(violations.length).toBe(1)
    expect(violations[0]?.valence).toBeLessThan(0)
  })

  it("should detect fulfilled return expectation", () => {
    const expectations: Expectation[] = [
      {
        content: "operator will return soon",
        source: "pattern",
        confidence: 0.5,
        expectedAt: null,
        valence: 0.6
      }
    ]

    const violations = checkExpectationViolations(expectations, true, 10, true)
    expect(violations.length).toBe(1)
    expect(violations[0]?.valence).toBeGreaterThan(0)
  })
})

describe("computeAnticipationEmotionTriggers", () => {
  it("should generate positive anticipation trigger", () => {
    const state = {
      ...DEFAULT_ANTICIPATORY_STATE,
      activeExpectations: [
        {
          content: "something good",
          source: "pattern" as const,
          confidence: 0.6,
          expectedAt: null,
          valence: 0.5
        }
      ]
    }

    const triggers = computeAnticipationEmotionTriggers(state)
    expect(triggers.length).toBeGreaterThan(0)
  })
})

describe("updateAnticipatoryState", () => {
  it("should decay old expectations", () => {
    const state = {
      ...DEFAULT_ANTICIPATORY_STATE,
      activeExpectations: [
        {
          content: "old expectation",
          source: "pattern" as const,
          confidence: 0.35,
          expectedAt: null,
          valence: 0.3
        }
      ]
    }

    const result = updateAnticipatoryState(
      state,
      {
        inConversation: false,
        operatorSilenceMinutes: 10,
        connectionLevel: 0.3,

        hasCalendarEvents: false
      },
      false,
      10,
      false
    )

    const oldExp = result.activeExpectations.find((e) => e.content === "old expectation")
    expect(oldExp?.confidence ?? 0).toBeLessThan(0.35)
  })
})
