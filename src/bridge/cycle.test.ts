import { err, ok } from "neverthrow"
import { describe, expect, it, vi } from "vitest"
import { animaError } from "@/lib/errors.ts"

vi.mock("@/lib/logger.ts", () => ({
  log: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() }
}))

vi.mock("@/lib/sentry.ts", () => ({
  captureError: vi.fn(),
  setTickContext: vi.fn(),
  setEmotionContext: vi.fn(),
  addBreadcrumb: vi.fn()
}))

vi.mock("@/lib/time.ts", () => ({
  sleep: vi.fn(),
  nowISO: vi.fn(() => "2026-01-01T00:00:00+00:00")
}))

vi.mock("@/core/intelligence.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/core/intelligence.ts")>()),
  callIntelligence: vi.fn()
}))

vi.mock("@/integrations/telegram.ts", () => ({
  fetchNewMessages: vi.fn(),
  sendMessageWithReply: vi.fn(),
  sendTypingAction: vi.fn()
}))

vi.mock("@/memory/working.ts", () => ({
  getActiveConversation: vi.fn(),
  getConversationBuffer: vi.fn(),
  pushToActiveConversation: vi.fn(),
  pushRecentResponse: vi.fn(),
  setLastUpdateId: vi.fn(),
  setOperatorLastActivity: vi.fn(),
  startNewConversation: vi.fn()
}))

vi.mock("@/bridge/handler.ts", () => ({
  buildConversationResponsePrompt: vi.fn(),
  computeFollowUpWait: vi.fn()
}))

vi.mock("@/bridge/afterthought.ts", () => ({
  checkForAfterthought: vi.fn()
}))

vi.mock("@/bridge/conversation.ts", () => ({
  detectConversationBoundary: vi.fn(),
  archiveConversation: vi.fn(),
  recallArchivedContext: vi.fn()
}))

vi.mock("@/bridge/timing.ts", () => ({
  computeTypingDuration: vi.fn(() => 0),
  computeReadTime: vi.fn(() => 0),
  computeThinkingDuration: vi.fn(() => 0),
  computeInterParagraphPause: vi.fn(() => 0),
  splitIntoParagraphs: vi.fn((text: string) => [text]),
  simulateTyping: vi.fn()
}))

vi.mock("@/prompts/conversation.ts", () => ({
  CONVERSATION_TRIAGE_SYSTEM_PROMPT: "mock conversation triage prompt",
  CONVERSATION_BOUNDARY_PROMPT: "mock boundary prompt"
}))

vi.mock("@/prompts/responder.ts", () => ({
  RESPONDER_SYSTEM_PROMPT: "mock responder prompt"
}))

vi.mock("@/evolution/prompt.ts", () => ({
  loadPrompt: vi.fn((_key: string, fallback: string) => fallback)
}))

vi.mock("@/emotion/state.ts", () => ({
  getEmotionalState: vi.fn(() => ({
    curiosity: 0.5,
    satisfaction: 0.5,
    frustration: 0.1,
    boredom: 0.3,
    excitement: 0.5,
    caution: 0.5,
    connection: 0.5
  })),
  saveEmotionalState: vi.fn(),
  processEmotionTrigger: vi.fn()
}))

vi.mock("@/emotion/update.ts", () => ({
  computeEmotionalUpdate: vi.fn((_state: unknown) => ({
    curiosity: 0.5,
    satisfaction: 0.5,
    frustration: 0.1,
    boredom: 0.3,
    excitement: 0.5,
    caution: 0.5,
    connection: 0.5
  }))
}))

vi.mock("@/core/consciousness.ts", () => ({
  buildConsciousnessPrompt: vi.fn(() => Promise.resolve("[IDENTITY]\nTest identity\n\npersonality prompt"))
}))

vi.mock("@/memory/episodic.ts", () => ({
  storeEpisode: vi.fn(),
  storeRelationshipEpisode: vi.fn()
}))

vi.mock("@/memory/semantic.ts", () => ({
  getOperatorLanguage: vi.fn(() => "German")
}))

import { checkForAfterthought } from "@/bridge/afterthought.ts"
import { computeFollowUpWait } from "@/bridge/handler.ts"
import { splitIntoParagraphs } from "@/bridge/timing.ts"
import { callIntelligence } from "@/core/intelligence.ts"
import { fetchNewMessages, sendMessageWithReply } from "@/integrations/telegram.ts"
import { storeEpisode } from "@/memory/episodic.ts"
import {
  getActiveConversation,
  getConversationBuffer,
  pushToActiveConversation,
  setLastUpdateId,
  setOperatorLastActivity,
  startNewConversation
} from "@/memory/working.ts"
import { runConversationLoop } from "./cycle.ts"

const mockFetchNewMessages = fetchNewMessages as ReturnType<typeof vi.fn>
const mockCallIntelligence = callIntelligence as ReturnType<typeof vi.fn>
const mockComputeFollowUpWait = computeFollowUpWait as ReturnType<typeof vi.fn>
const mockGetActiveConversation = getActiveConversation as ReturnType<typeof vi.fn>
const mockGetConversationBuffer = getConversationBuffer as ReturnType<typeof vi.fn>
const mockPushToActiveConversation = pushToActiveConversation as ReturnType<typeof vi.fn>
const mockSetLastUpdateId = setLastUpdateId as ReturnType<typeof vi.fn>
const mockSetOperatorLastActivity = setOperatorLastActivity as ReturnType<typeof vi.fn>
const mockStartNewConversation = startNewConversation as ReturnType<typeof vi.fn>
const mockSendMessageWithReply = sendMessageWithReply as ReturnType<typeof vi.fn>
const mockStoreEpisode = storeEpisode as ReturnType<typeof vi.fn>
const mockCheckForAfterthought = checkForAfterthought as ReturnType<typeof vi.fn>
const mockSplitIntoParagraphs = splitIntoParagraphs as ReturnType<typeof vi.fn>

const makeTestMessage = (overrides?: Record<string, unknown>) => ({
  updateId: 1,
  chatId: 123,
  from: "operator",
  text: "Hello",
  date: Math.floor(Date.now() / 1000),
  messageId: 100,
  ...overrides
})

beforeEach(() => {
  vi.clearAllMocks()
  mockGetActiveConversation.mockResolvedValue(null)
  mockGetConversationBuffer.mockResolvedValue([])
  mockStartNewConversation.mockResolvedValue(null)
  mockSetLastUpdateId.mockResolvedValue(undefined)
  mockSetOperatorLastActivity.mockResolvedValue(undefined)
  mockSendMessageWithReply.mockResolvedValue(42)
  mockSplitIntoParagraphs.mockImplementation((text: string) => [text])
  mockCheckForAfterthought.mockResolvedValue(null)
})

describe("runConversationLoop", () => {
  it("creates new conversation slot when none exists", async () => {
    mockCallIntelligence.mockResolvedValue(
      ok({ decision: "idle", reason: "test", confidence: 0.9, estimatedTokens: 0 })
    )

    await runConversationLoop([makeTestMessage()])

    expect(mockStartNewConversation).toHaveBeenCalled()
  })

  it("processes triage → respond → send flow", async () => {
    mockCallIntelligence
      .mockResolvedValueOnce(ok({ decision: "simple", reason: "greeting", confidence: 0.9, estimatedTokens: 100 }))
      .mockResolvedValueOnce(ok({ messages: [{ text: "Hi!" }], expectsReply: false }))

    const result = await runConversationLoop([makeTestMessage()])

    expect(mockCallIntelligence).toHaveBeenCalledTimes(2)
    expect(mockSendMessageWithReply).toHaveBeenCalledWith("Hi!", undefined)
    expect(result).toEqual({ rounds: 1 })
  })

  it("handles follow-up loop when expectsReply is true", async () => {
    mockFetchNewMessages
      .mockResolvedValueOnce({
        messages: [makeTestMessage({ text: "How are you?", updateId: 2, messageId: 101 })],
        maxUpdateId: 101
      })
      .mockResolvedValueOnce({ messages: [], maxUpdateId: null })

    mockCallIntelligence
      .mockResolvedValueOnce(ok({ decision: "simple", reason: "chat", confidence: 0.9, estimatedTokens: 100 }))
      .mockResolvedValueOnce(ok({ messages: [{ text: "Hello!" }], expectsReply: true }))
      .mockResolvedValueOnce(ok({ decision: "simple", reason: "chat", confidence: 0.9, estimatedTokens: 100 }))
      .mockResolvedValueOnce(ok({ messages: [{ text: "Hello!" }], expectsReply: true }))
    mockComputeFollowUpWait.mockReturnValue(60)

    const result = await runConversationLoop([makeTestMessage({ text: "Hi" })])

    expect(mockFetchNewMessages).toHaveBeenCalledTimes(2)
    expect(mockFetchNewMessages).toHaveBeenNthCalledWith(1, 60)
    expect(result).toEqual({ rounds: 2 })
  })

  it("breaks on triage failure", async () => {
    mockCallIntelligence.mockResolvedValue(err(animaError("LLM_ERROR", "triage failed")))

    const result = await runConversationLoop([makeTestMessage()])

    expect(result).toEqual({ rounds: 1 })
    expect(mockCallIntelligence).toHaveBeenCalledTimes(1)
  })

  it("handles idle decision gracefully", async () => {
    mockCallIntelligence.mockResolvedValue(
      ok({ decision: "idle", reason: "just an ack", confidence: 0.95, estimatedTokens: 0 })
    )

    const result = await runConversationLoop([makeTestMessage()])

    expect(result).toEqual({ rounds: 1 })
    expect(mockCallIntelligence).toHaveBeenCalledTimes(1)
    expect(mockStoreEpisode).toHaveBeenCalledWith(
      expect.stringContaining("chose not to respond"),
      "interaction",
      expect.any(Object)
    )
  })

  it("splits paragraphs and sends them as separate messages", async () => {
    mockCallIntelligence
      .mockResolvedValueOnce(ok({ decision: "simple", reason: "chat", confidence: 0.9, estimatedTokens: 100 }))
      .mockResolvedValueOnce(ok({ messages: [{ text: "First paragraph.\n\nSecond paragraph." }], expectsReply: false }))
    mockSplitIntoParagraphs.mockReturnValue(["First paragraph.", "Second paragraph."])

    await runConversationLoop([makeTestMessage()])

    expect(mockSendMessageWithReply).toHaveBeenCalledTimes(2)
    expect(mockSendMessageWithReply).toHaveBeenNthCalledWith(1, "First paragraph.", undefined)
    expect(mockSendMessageWithReply).toHaveBeenNthCalledWith(2, "Second paragraph.", undefined)
  })

  it("includes messageId when pushing operator messages to buffer", async () => {
    mockCallIntelligence.mockResolvedValue(
      ok({ decision: "idle", reason: "test", confidence: 0.9, estimatedTokens: 0 })
    )

    await runConversationLoop([makeTestMessage({ messageId: 555 })])

    expect(mockPushToActiveConversation).toHaveBeenCalledWith([
      expect.objectContaining({ role: "operator", messageId: 555 })
    ])
  })

  it("includes sentMessageId when pushing ANIMA messages to buffer", async () => {
    mockCallIntelligence
      .mockResolvedValueOnce(ok({ decision: "simple", reason: "chat", confidence: 0.9, estimatedTokens: 100 }))
      .mockResolvedValueOnce(ok({ messages: [{ text: "Hi!" }], expectsReply: false }))
    mockSendMessageWithReply.mockResolvedValue(999)

    await runConversationLoop([makeTestMessage()])

    expect(mockPushToActiveConversation).toHaveBeenCalledWith([
      expect.objectContaining({ role: "anima", text: "Hi!", messageId: 999 })
    ])
  })

  it("checks for afterthought after main response", async () => {
    mockCallIntelligence
      .mockResolvedValueOnce(ok({ decision: "simple", reason: "chat", confidence: 0.9, estimatedTokens: 100 }))
      .mockResolvedValueOnce(ok({ messages: [{ text: "Hello!" }], expectsReply: false }))

    await runConversationLoop([makeTestMessage()])

    expect(mockCheckForAfterthought).toHaveBeenCalled()
  })

  it("sends afterthought message when checkForAfterthought returns a result", async () => {
    mockCallIntelligence
      .mockResolvedValueOnce(ok({ decision: "simple", reason: "chat", confidence: 0.9, estimatedTokens: 100 }))
      .mockResolvedValueOnce(ok({ messages: [{ text: "Hello!" }], expectsReply: false }))
    mockCheckForAfterthought.mockResolvedValue({ text: "Oh wait, one more thing!", replyTo: 100 })
    mockSendMessageWithReply.mockResolvedValue(42)

    await runConversationLoop([makeTestMessage()])

    expect(mockSendMessageWithReply).toHaveBeenCalledWith("Oh wait, one more thing!", 100)
    expect(mockStoreEpisode).toHaveBeenCalledWith(
      expect.stringContaining("Afterthought"),
      "interaction",
      expect.any(Object)
    )
  })

  it("ends conversation when follow-up poll times out", async () => {
    mockFetchNewMessages.mockResolvedValueOnce({ messages: [], maxUpdateId: null })

    mockCallIntelligence
      .mockResolvedValueOnce(ok({ decision: "simple", reason: "chat", confidence: 0.9, estimatedTokens: 100 }))
      .mockResolvedValueOnce(ok({ messages: [{ text: "Sure!" }], expectsReply: true }))
    mockComputeFollowUpWait.mockReturnValue(120)

    const result = await runConversationLoop([makeTestMessage()])

    expect(result).toEqual({ rounds: 1 })
    expect(mockFetchNewMessages).toHaveBeenNthCalledWith(1, 120)
  })
})
