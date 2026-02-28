import { err, ok } from "neverthrow"
import { describe, expect, it, vi } from "vitest"
import { animaError } from "@/lib/errors.ts"

vi.mock("@/core/intelligence.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/core/intelligence.ts")>()),
  callIntelligence: vi.fn()
}))

vi.mock("@/lib/logger.ts", () => ({
  log: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() }
}))

vi.mock("@/prompts/afterthought.ts", () => ({
  AFTERTHOUGHT_SYSTEM_PROMPT: "mock afterthought prompt"
}))

import { callIntelligence } from "@/core/intelligence.ts"
import { makeConversationMessage, makeConversationSlot } from "@/test/factories.ts"
import { checkForAfterthought } from "./afterthought.ts"

const mockCallIntelligence = callIntelligence as ReturnType<typeof vi.fn>

describe("checkForAfterthought", () => {
  it("returns null for empty conversation buffer", async () => {
    const result = await checkForAfterthought([], "personality", "German")
    expect(result).toBeNull()
    expect(mockCallIntelligence).not.toHaveBeenCalled()
  })

  it("returns null when active slot has fewer than 2 messages", async () => {
    const buffer = [makeConversationSlot({ messages: [makeConversationMessage()] })]
    const result = await checkForAfterthought(buffer, "personality", "German")
    expect(result).toBeNull()
    expect(mockCallIntelligence).not.toHaveBeenCalled()
  })

  it("returns null when LLM decides not to send", async () => {
    mockCallIntelligence.mockResolvedValue(ok({ send: false }))
    const buffer = [
      makeConversationSlot({
        messages: [
          makeConversationMessage({ role: "operator", text: "Hey", messageId: 100 }),
          makeConversationMessage({ role: "anima", text: "Hello!", messageId: 101 })
        ]
      })
    ]

    const result = await checkForAfterthought(buffer, "personality", "German")
    expect(result).toBeNull()
  })

  it("returns text and replyTo when LLM decides to send", async () => {
    mockCallIntelligence.mockResolvedValue(ok({ send: true, text: "Oh, one more thing!", replyTo: 100 }))
    const buffer = [
      makeConversationSlot({
        messages: [
          makeConversationMessage({ role: "operator", text: "How are you?", messageId: 100 }),
          makeConversationMessage({ role: "anima", text: "Doing great!", messageId: 101 })
        ]
      })
    ]

    const result = await checkForAfterthought(buffer, "personality", "German")
    expect(result).toEqual({ text: "Oh, one more thing!", replyTo: 100 })
  })

  it("returns text without replyTo when not specified", async () => {
    mockCallIntelligence.mockResolvedValue(ok({ send: true, text: "By the way..." }))
    const buffer = [
      makeConversationSlot({
        messages: [
          makeConversationMessage({ role: "operator", text: "Hey", messageId: 100 }),
          makeConversationMessage({ role: "anima", text: "Hi!", messageId: 101 })
        ]
      })
    ]

    const result = await checkForAfterthought(buffer, "personality", "German")
    expect(result).toEqual({ text: "By the way...", replyTo: undefined })
  })

  it("returns null when LLM call fails", async () => {
    mockCallIntelligence.mockResolvedValue(err(animaError("LLM_ERROR", "API down")))
    const buffer = [
      makeConversationSlot({
        messages: [
          makeConversationMessage({ role: "operator", text: "Hey", messageId: 100 }),
          makeConversationMessage({ role: "anima", text: "Hi!", messageId: 101 })
        ]
      })
    ]

    const result = await checkForAfterthought(buffer, "personality", "German")
    expect(result).toBeNull()
  })
})
