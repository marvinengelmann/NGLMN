import { ok } from "neverthrow"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/integrations/anthropic.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/integrations/anthropic.ts")>()),
  callClaude: vi.fn()
}))

vi.mock("@/memory/episodic.ts", () => ({
  storeEpisode: vi.fn(),
  storeRelationshipEpisode: vi.fn(),
  queryRelated: vi.fn()
}))

import { callClaude } from "@/integrations/anthropic.ts"
import { queryRelated, storeEpisode, storeRelationshipEpisode } from "@/memory/episodic.ts"
import { makeConversationSlot, makeEmotionalState, makePendingMessage } from "@/test/factories.ts"
import { archiveConversation, detectConversationBoundary, recallArchivedContext } from "./conversation.ts"

const mockCallClaude = callClaude as ReturnType<typeof vi.fn>
const mockStoreEpisode = storeEpisode as ReturnType<typeof vi.fn>
const mockStoreRelationshipEpisode = storeRelationshipEpisode as ReturnType<typeof vi.fn>
const mockQueryRelated = queryRelated as ReturnType<typeof vi.fn>

describe("detectConversationBoundary", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns continuation when active slot is empty", async () => {
    const slot = makeConversationSlot({ messages: [] })
    const result = await detectConversationBoundary(slot, [makePendingMessage()])
    expect(result.isNewConversation).toBe(false)
    expect(mockCallClaude).not.toHaveBeenCalled()
  })

  it("calls Haiku to classify when slot has messages", async () => {
    mockCallClaude.mockResolvedValue(ok(JSON.stringify({ isNewConversation: false, reason: "same topic" })))

    const slot = makeConversationSlot()
    const newMsgs = [makePendingMessage({ text: "What about that?" })]

    const result = await detectConversationBoundary(slot, newMsgs)

    expect(mockCallClaude).toHaveBeenCalledOnce()
    expect(result.isNewConversation).toBe(false)
    expect(result.reason).toBe("same topic")
  })

  it("detects new conversation when Haiku says so", async () => {
    mockCallClaude.mockResolvedValue(
      ok(JSON.stringify({ isNewConversation: true, reason: "completely different topic" }))
    )

    const slot = makeConversationSlot()
    const newMsgs = [makePendingMessage({ text: "Unrelated question" })]

    const result = await detectConversationBoundary(slot, newMsgs)
    expect(result.isNewConversation).toBe(true)
  })

  it("falls back to continuation on parse error", async () => {
    mockCallClaude.mockResolvedValue(ok("invalid json"))

    const slot = makeConversationSlot()
    const newMsgs = [makePendingMessage({ text: "Hello" })]

    const result = await detectConversationBoundary(slot, newMsgs)
    expect(result.isNewConversation).toBe(false)
    expect(result.reason).toContain("parse failed")
  })
})

describe("archiveConversation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("does nothing for empty messages", async () => {
    await archiveConversation([], makeEmotionalState())
    expect(mockCallClaude).not.toHaveBeenCalled()
  })

  it("summarizes and stores as interaction episode", async () => {
    mockCallClaude.mockResolvedValue(ok("Discussed project goals"))

    const messages = makeConversationSlot().messages
    const emotion = makeEmotionalState({ connection: 0.4 })

    await archiveConversation(messages, emotion)

    expect(mockCallClaude).toHaveBeenCalledOnce()
    expect(mockStoreEpisode).toHaveBeenCalledWith("Discussed project goals", "interaction", {
      relevanceScore: 0.7
    })
  })

  it("stores relationship episode when connection > 0.6", async () => {
    mockCallClaude.mockResolvedValue(ok("Deep personal conversation"))

    const messages = makeConversationSlot().messages
    const emotion = makeEmotionalState({ connection: 0.8 })

    await archiveConversation(messages, emotion)

    expect(mockStoreRelationshipEpisode).toHaveBeenCalledWith("Deep personal conversation")
    expect(mockStoreEpisode).not.toHaveBeenCalled()
  })
})

describe("recallArchivedContext", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns null when replyToText found in active conversations", async () => {
    const slot = makeConversationSlot({
      messages: [{ role: "anima", text: "Original message", timestamp: new Date().toISOString(), messageId: 100 }]
    })
    const result = await recallArchivedContext("Original message", [slot])
    expect(result).toBeNull()
    expect(mockQueryRelated).not.toHaveBeenCalled()
  })

  it("queries vector DB when text not in active conversations", async () => {
    mockQueryRelated.mockResolvedValue([{ score: 0.85, metadata: { category: "interaction" } }])

    const result = await recallArchivedContext("Some old message", [makeConversationSlot()])
    expect(mockQueryRelated).toHaveBeenCalledWith("Some old message", 3)
    expect(result).toContain("relevance 0.85")
  })

  it("returns null when no relevant results", async () => {
    mockQueryRelated.mockResolvedValue([{ score: 0.3, metadata: { category: "interaction" } }])

    const result = await recallArchivedContext("Something irrelevant", [makeConversationSlot()])
    expect(result).toBeNull()
  })
})
