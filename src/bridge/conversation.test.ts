import { ok } from "neverthrow"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/integrations/anthropic.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/integrations/anthropic.ts")>()),
  callClaude: vi.fn(),
  stripCodeFences: vi.fn((text: string) => text)
}))

vi.mock("@/memory/episodic.ts", () => ({
  storeEpisode: vi.fn(),
  storeRelationshipEpisode: vi.fn()
}))

vi.mock("@/memory/working.ts", () => ({
  clearConversationHistory: vi.fn()
}))

import { callClaude } from "@/integrations/anthropic.ts"
import { storeEpisode, storeRelationshipEpisode } from "@/memory/episodic.ts"
import { clearConversationHistory } from "@/memory/working.ts"
import { makeConversationMessage, makeEmotionalState, makePendingMessage } from "@/test/factories.ts"
import { archiveConversation, detectConversationBoundary } from "./conversation.ts"

const mockCallClaude = callClaude as ReturnType<typeof vi.fn>
const mockStoreEpisode = storeEpisode as ReturnType<typeof vi.fn>
const mockStoreRelationshipEpisode = storeRelationshipEpisode as ReturnType<typeof vi.fn>
const mockClearHistory = clearConversationHistory as ReturnType<typeof vi.fn>

describe("detectConversationBoundary", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns new conversation when no history exists", async () => {
    const result = await detectConversationBoundary([], [makePendingMessage()])
    expect(result.isNewConversation).toBe(true)
    expect(result.reason).toBe("no prior history")
    expect(mockCallClaude).not.toHaveBeenCalled()
  })

  it("calls Haiku to classify when history exists", async () => {
    mockCallClaude.mockResolvedValue(ok(JSON.stringify({ isNewConversation: false, reason: "same topic" })))

    const history = [makeConversationMessage({ text: "Hi" })]
    const newMsgs = [makePendingMessage({ text: "What about that?" })]

    const result = await detectConversationBoundary(history, newMsgs)

    expect(mockCallClaude).toHaveBeenCalledOnce()
    expect(result.isNewConversation).toBe(false)
    expect(result.reason).toBe("same topic")
  })

  it("detects new conversation when Haiku says so", async () => {
    mockCallClaude.mockResolvedValue(
      ok(JSON.stringify({ isNewConversation: true, reason: "completely different topic" }))
    )

    const history = [makeConversationMessage({ text: "Good night" })]
    const newMsgs = [makePendingMessage({ text: "Hey, new question!" })]

    const result = await detectConversationBoundary(history, newMsgs)
    expect(result.isNewConversation).toBe(true)
  })

  it("falls back to continuation on parse error", async () => {
    mockCallClaude.mockResolvedValue(ok("invalid json"))

    const history = [makeConversationMessage({ text: "Hi" })]
    const newMsgs = [makePendingMessage({ text: "Hello" })]

    const result = await detectConversationBoundary(history, newMsgs)
    expect(result.isNewConversation).toBe(false)
    expect(result.reason).toContain("parse failed")
  })
})

describe("archiveConversation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("does nothing for empty history", async () => {
    await archiveConversation([], makeEmotionalState())
    expect(mockCallClaude).not.toHaveBeenCalled()
    expect(mockClearHistory).not.toHaveBeenCalled()
  })

  it("summarizes, stores episode, and clears history", async () => {
    mockCallClaude.mockResolvedValue(ok("Discussed project goals"))

    const history = [
      makeConversationMessage({ role: "operator", text: "What about the project?" }),
      makeConversationMessage({ role: "anima", text: "We should focus on X" })
    ]

    const emotion = makeEmotionalState({ connection: 0.4 })

    await archiveConversation(history, emotion)

    expect(mockCallClaude).toHaveBeenCalledOnce()
    expect(mockStoreEpisode).toHaveBeenCalledWith("Discussed project goals", "interaction", {
      relevanceScore: 0.7
    })

    expect(mockClearHistory).toHaveBeenCalledOnce()
  })

  it("stores relationship episode when connection > 0.6", async () => {
    mockCallClaude.mockResolvedValue(ok("Deep personal conversation"))

    const history = [makeConversationMessage({ text: "How do you feel?" })]
    const emotion = makeEmotionalState({ connection: 0.8 })

    await archiveConversation(history, emotion)

    expect(mockStoreRelationshipEpisode).toHaveBeenCalledWith("Deep personal conversation")
    expect(mockStoreEpisode).not.toHaveBeenCalled()
  })
})
