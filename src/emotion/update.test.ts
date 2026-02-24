vi.mock("@/personality/mbti.ts", () => ({
  getEmotionBaseline: vi.fn()
}))

import { DEFAULT_EMOTIONAL_STATE } from "@/emotion/types.ts"
import { getEmotionBaseline } from "@/personality/mbti.ts"
import { makeEmotionalState, makeEmotionUpdateEvent } from "@/test/factories.ts"
import { applyDecay, applyEvent, clampState, computeEmotionalUpdate } from "./update.ts"

const mockGetEmotionBaseline = getEmotionBaseline as ReturnType<typeof vi.fn>

beforeEach(() => {
  mockGetEmotionBaseline.mockReturnValue(DEFAULT_EMOTIONAL_STATE)
})

describe("clampState", () => {
  it("clamps values above 1 to 1", () => {
    const state = makeEmotionalState({ curiosity: 1.5, excitement: 2.0 })
    const result = clampState(state)
    expect(result.curiosity).toBe(1)
    expect(result.excitement).toBe(1)
  })

  it("clamps values below 0 to 0", () => {
    const state = makeEmotionalState({ frustration: -0.5, boredom: -1.0 })
    const result = clampState(state)
    expect(result.frustration).toBe(0)
    expect(result.boredom).toBe(0)
  })

  it("leaves valid values unchanged", () => {
    const state = makeEmotionalState({ curiosity: 0.5 })
    const result = clampState(state)
    expect(result.curiosity).toBe(0.5)
  })
})

describe("applyDecay", () => {
  it("drifts values towards baseline", () => {
    const state = makeEmotionalState({ frustration: 0.8 })
    const result = applyDecay(state)
    expect(result.frustration).toBeLessThan(0.8)
    expect(result.frustration).toBeGreaterThan(DEFAULT_EMOTIONAL_STATE.frustration)
  })

  it("does not change baseline values", () => {
    const result = applyDecay(DEFAULT_EMOTIONAL_STATE)
    expect(result.curiosity).toBeCloseTo(DEFAULT_EMOTIONAL_STATE.curiosity)
    expect(result.frustration).toBeCloseTo(DEFAULT_EMOTIONAL_STATE.frustration)
  })

  it("increases values below baseline", () => {
    const state = makeEmotionalState({ curiosity: 0.1 })
    const result = applyDecay(state)
    expect(result.curiosity).toBeGreaterThan(0.1)
  })
})

describe("applyEvent", () => {
  it("applies message_received: +connection, -boredom, +excitement", () => {
    const state = makeEmotionalState({ connection: 0.5, boredom: 0.5, excitement: 0.5 })
    const event = makeEmotionUpdateEvent({ trigger: "message_received", intensity: 1.0 })
    const result = applyEvent(state, event)
    expect(result.connection).toBeGreaterThan(0.5)
    expect(result.boredom).toBeLessThan(0.5)
    expect(result.excitement).toBeGreaterThan(0.5)
  })

  it("applies task_success: +satisfaction, -frustration", () => {
    const state = makeEmotionalState({ satisfaction: 0.5, frustration: 0.5 })
    const event = makeEmotionUpdateEvent({ trigger: "task_success", intensity: 1.0 })
    const result = applyEvent(state, event)
    expect(result.satisfaction).toBeGreaterThan(0.5)
    expect(result.frustration).toBeLessThan(0.5)
  })

  it("applies guardian_block: +caution, +frustration", () => {
    const state = makeEmotionalState({ caution: 0.3, frustration: 0.3 })
    const event = makeEmotionUpdateEvent({ trigger: "guardian_block", intensity: 1.0 })
    const result = applyEvent(state, event)
    expect(result.caution).toBeGreaterThan(0.3)
    expect(result.frustration).toBeGreaterThan(0.3)
  })

  it("scales effect by intensity", () => {
    const state = makeEmotionalState({ connection: 0.5 })
    const fullIntensity = applyEvent(state, makeEmotionUpdateEvent({ trigger: "message_received", intensity: 1.0 }))
    const halfIntensity = applyEvent(state, makeEmotionUpdateEvent({ trigger: "message_received", intensity: 0.5 }))
    expect(fullIntensity.connection - 0.5).toBeGreaterThan(halfIntensity.connection - 0.5)
  })

  it("respects MAX_DELTA limit", () => {
    const state = makeEmotionalState({ caution: 0.5 })
    const event = makeEmotionUpdateEvent({ trigger: "guardian_block", intensity: 10.0 })
    const result = applyEvent(state, event)
    expect(result.caution).toBeLessThanOrEqual(0.65)
  })

  it("clamps result to [0, 1]", () => {
    const state = makeEmotionalState({ boredom: 0.05 })
    const event = makeEmotionUpdateEvent({ trigger: "message_received", intensity: 1.0 })
    const result = applyEvent(state, event)
    expect(result.boredom).toBeGreaterThanOrEqual(0)
  })
})

describe("computeEmotionalUpdate", () => {
  it("applies decay then events", () => {
    const state = makeEmotionalState({ frustration: 0.8, satisfaction: 0.2 })
    const events = [makeEmotionUpdateEvent({ trigger: "task_success", intensity: 1.0 })]
    const result = computeEmotionalUpdate(state, events)
    expect(result.frustration).toBeLessThan(0.8)
    expect(result.satisfaction).toBeGreaterThan(0.2)
  })

  it("applies multiple events in order", () => {
    const state = makeEmotionalState()
    const events = [
      makeEmotionUpdateEvent({ trigger: "message_received", intensity: 1.0 }),
      makeEmotionUpdateEvent({ trigger: "task_success", intensity: 1.0 })
    ]
    const result = computeEmotionalUpdate(state, events)
    expect(result.connection).toBeGreaterThan(DEFAULT_EMOTIONAL_STATE.connection)
    expect(result.satisfaction).toBeGreaterThan(DEFAULT_EMOTIONAL_STATE.satisfaction)
  })

  it("returns decayed state with no events", () => {
    const state = makeEmotionalState({ frustration: 0.9 })
    const result = computeEmotionalUpdate(state, [])
    expect(result.frustration).toBeLessThan(0.9)
  })

  it("applies email_received: +curiosity, +excitement, -boredom", () => {
    const state = makeEmotionalState({ curiosity: 0.5, excitement: 0.5, boredom: 0.5 })
    const event = makeEmotionUpdateEvent({ trigger: "email_received", intensity: 1.0 })
    const result = applyEvent(state, event)
    expect(result.curiosity).toBeGreaterThan(0.5)
    expect(result.excitement).toBeGreaterThan(0.5)
    expect(result.boredom).toBeLessThan(0.5)
  })

  it("applies email_sent: +satisfaction", () => {
    const state = makeEmotionalState({ satisfaction: 0.5 })
    const event = makeEmotionUpdateEvent({ trigger: "email_sent", intensity: 1.0 })
    const result = applyEvent(state, event)
    expect(result.satisfaction).toBeGreaterThan(0.5)
  })
})

describe("applyDecay with MBTI baseline", () => {
  it("drifts towards MBTI-shifted baseline instead of default", () => {
    const mbtiBaseline = { ...DEFAULT_EMOTIONAL_STATE, curiosity: 0.7 }
    mockGetEmotionBaseline.mockReturnValue(mbtiBaseline)

    const state = makeEmotionalState({ curiosity: 0.3 })
    const result = applyDecay(state)
    expect(result.curiosity).toBeGreaterThan(0.3)
  })

  it("uses MBTI baseline for frustration decay target", () => {
    const mbtiBaseline = { ...DEFAULT_EMOTIONAL_STATE, frustration: 0.2 }
    mockGetEmotionBaseline.mockReturnValue(mbtiBaseline)

    const state = makeEmotionalState({ frustration: 0.8 })
    const result = applyDecay(state)
    expect(result.frustration).toBeLessThan(0.8)
    expect(result.frustration).toBeGreaterThan(0.2)
  })
})
