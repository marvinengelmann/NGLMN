import { err, ok } from "neverthrow"
import { describe, expect, it, vi } from "vitest"
import { animaError } from "@/config/errors.ts"

vi.mock("@/integrations/anthropic.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/integrations/anthropic.ts")>()),
  callClaude: vi.fn()
}))

vi.mock("@/lib/logger.ts", () => ({
  log: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() }
}))

vi.mock("@/prompts/afterthought.ts", () => ({
  AFTERTHOUGHT_SYSTEM_PROMPT: "mock afterthought prompt"
}))

import { callClaude } from "@/integrations/anthropic.ts"
import { makeConversationMessage, makeConversationSlot } from "@/test/factories.ts"
import { checkForAfterthought } from "./afterthought.ts"

const mockCallClaude = callClaude as ReturnType<typeof vi.fn>

describe("checkForAfterthought", () => {
  it("returns null for empty conversation buffer", async () => {
    const result = await checkForAfterthought([], "personality", "German")
    expect(result).toBeNull()
    expect(mockCallClaude).not.toHaveBeenCalled()
  })

  it("returns null when active slot has fewer than 2 messages", async () => {
    const buffer = [makeConversationSlot({ messages: [makeConversationMessage()] })]
    const result = await checkForAfterthought(buffer, "personality", "German")
    expect(result).toBeNull()
    expect(mockCallClaude).not.toHaveBeenCalled()
  })

  it("returns null when Claude decides not to send", async () => {
    mockCallClaude.mockResolvedValue(ok('{"send": false}'))
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

  it("returns text and replyTo when Claude decides to send", async () => {
    mockCallClaude.mockResolvedValue(ok('{"send": true, "text": "Oh, one more thing!", "replyTo": 100}'))
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
    mockCallClaude.mockResolvedValue(ok('{"send": true, "text": "By the way..."}'))
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

  it("returns null on parse error", async () => {
    mockCallClaude.mockResolvedValue(ok("not json at all {{{"))
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

  it("returns null when Claude call fails", async () => {
    mockCallClaude.mockResolvedValue(err(animaError("ANTHROPIC_ERROR", "API down")))
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
