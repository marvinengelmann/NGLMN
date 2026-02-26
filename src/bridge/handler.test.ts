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
import { computeFollowUpWait, parseStructuredResponse } from "./handler.ts"

describe("parseStructuredResponse", () => {
  it("parses valid structured JSON with multiple messages", () => {
    const raw = JSON.stringify({
      messages: [{ text: "Hello!", replyTo: 42 }, { text: "How are you?" }],
      expectsReply: true
    })
    const result = parseStructuredResponse(raw)
    expect(result.messages).toHaveLength(2)
    expect(result.messages[0]).toEqual({ text: "Hello!", replyTo: 42 })
    expect(result.messages[1]).toEqual({ text: "How are you?" })
    expect(result.expectsReply).toBe(true)
  })

  it("parses JSON wrapped in code fences", () => {
    const raw = '```json\n{"messages": [{"text": "Hi"}], "expectsReply": false}\n```'
    const result = parseStructuredResponse(raw)
    expect(result.messages).toHaveLength(1)
    expect(result.messages[0]?.text).toBe("Hi")
    expect(result.expectsReply).toBe(false)
  })

  it("falls back to single message for plain text", () => {
    const raw = "Just a plain text response"
    const result = parseStructuredResponse(raw)
    expect(result.messages).toHaveLength(1)
    expect(result.messages[0]?.text).toBe("Just a plain text response")
    expect(result.expectsReply).toBe(true)
  })

  it("falls back to single message for invalid JSON", () => {
    const raw = "{ broken json }}}"
    const result = parseStructuredResponse(raw)
    expect(result.messages).toHaveLength(1)
    expect(result.messages[0]?.text).toBe("{ broken json }}}")
    expect(result.expectsReply).toBe(true)
  })

  it("falls back when messages array is empty", () => {
    const raw = JSON.stringify({ messages: [] })
    const result = parseStructuredResponse(raw)
    expect(result.messages).toHaveLength(1)
    expect(result.expectsReply).toBe(true)
  })

  it("omits replyTo when not present", () => {
    const raw = JSON.stringify({ messages: [{ text: "No reply" }], expectsReply: true })
    const result = parseStructuredResponse(raw)
    expect(result.messages[0]).toEqual({ text: "No reply" })
    expect(result.messages[0]).not.toHaveProperty("replyTo")
  })
})

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
