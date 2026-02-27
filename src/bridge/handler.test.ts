import { describe, expect, it, vi } from "vitest"

vi.mock("@/memory/working.ts", () => ({
  getConversationBuffer: vi.fn(),
  pushToActiveConversation: vi.fn()
}))

vi.mock("@/core/context-builder.ts", () => ({
  buildSimpleContext: vi.fn(),
  buildComplexContext: vi.fn(),
  buildDeepContext: vi.fn()
}))

import { makeEmotionalState } from "@/test/factories.ts"
import { computeFollowUpWait } from "./handler.ts"

describe("computeFollowUpWait", () => {
  it("returns value between 60 and 240 seconds", () => {
    const emotion = makeEmotionalState()
    const wait = computeFollowUpWait(emotion)
    expect(wait).toBeGreaterThanOrEqual(60)
    expect(wait).toBeLessThanOrEqual(240)
  })

  it("returns longer wait for high connection", () => {
    const low = computeFollowUpWait(makeEmotionalState({ connection: 0.1 }))
    const high = computeFollowUpWait(makeEmotionalState({ connection: 0.9 }))
    expect(high).toBeGreaterThan(low)
  })

  it("returns shorter wait for high boredom", () => {
    const low = computeFollowUpWait(makeEmotionalState({ boredom: 0.1 }))
    const high = computeFollowUpWait(makeEmotionalState({ boredom: 0.9 }))
    expect(high).toBeLessThan(low)
  })

  it("returns longer wait for high excitement", () => {
    const low = computeFollowUpWait(makeEmotionalState({ excitement: 0.1 }))
    const high = computeFollowUpWait(makeEmotionalState({ excitement: 0.9 }))
    expect(high).toBeGreaterThan(low)
  })

  it("clamps minimum at 60 seconds", () => {
    const emotion = makeEmotionalState({ connection: 0, excitement: 0, boredom: 1.0 })
    const wait = computeFollowUpWait(emotion)
    expect(wait).toBe(60)
  })

  it("clamps maximum at 240 seconds", () => {
    const emotion = makeEmotionalState({ connection: 1.0, excitement: 1.0, boredom: 0 })
    const wait = computeFollowUpWait(emotion)
    expect(wait).toBe(220)
  })
})
