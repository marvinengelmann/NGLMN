import { err, ok } from "neverthrow"
import { describe, expect, it, vi } from "vitest"
import { animaError } from "@/config/errors.ts"

vi.mock("@trigger.dev/sdk", () => ({
  schedules: { task: vi.fn((config: Record<string, unknown>) => ({ ...config, trigger: vi.fn() })) }
}))

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
  sleep: vi.fn()
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

vi.mock("@/bridge/typing.ts", () => ({
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

vi.mock("@/evolution/prompt-loader.ts", () => ({
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

vi.mock("@/personality/dna.ts", () => ({
  getEffectivePersonality: vi.fn()
}))

vi.mock("@/personality/expression.ts", () => ({
  buildPersonalityPrompt: vi.fn(() => "personality prompt")
}))

vi.mock("@/personality/mbti.ts", () => ({
  getMbtiType: vi.fn(() => "INFP-T")
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
import { splitIntoParagraphs } from "@/bridge/typing.ts"
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
import { humanBridgeTask } from "./human-bridge.ts"

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

const run = (humanBridgeTask as unknown as Record<string, () => Promise<unknown>>).run as () => Promise<unknown>

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

describe("human-bridge", () => {
  it("exports a schedules task with correct config", () => {
    expect(humanBridgeTask).toBeDefined()
    const task = humanBridgeTask as unknown as Record<string, unknown>
    expect(task.id).toBe("human-bridge")
    expect(task.cron).toBe("*/1 * * * *")
    expect(task.queue).toEqual({ concurrencyLimit: 1 })
    expect(task.maxDuration).toBe(600)
  })

  it("exits with 0 rounds when no messages after initial poll", async () => {
    mockFetchNewMessages.mockResolvedValue({ messages: [], maxUpdateId: null })

    const result = await run()

    expect(result).toEqual({ rounds: 0 })
    expect(mockSetLastUpdateId).not.toHaveBeenCalled()
    expect(mockSetOperatorLastActivity).not.toHaveBeenCalled()
  })

  it("commits offset and sets operator activity on initial messages", async () => {
    mockFetchNewMessages.mockResolvedValueOnce({ messages: [makeTestMessage()], maxUpdateId: 100 })
    mockCallIntelligence.mockResolvedValue(
      ok({ decision: "idle", reason: "test", confidence: 0.9, estimatedTokens: 0 })
    )

    await run()

    expect(mockSetLastUpdateId).toHaveBeenCalledWith(100)
    expect(mockSetOperatorLastActivity).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}/))
  })

  it("creates new conversation slot when none exists", async () => {
    mockFetchNewMessages.mockResolvedValueOnce({ messages: [makeTestMessage()], maxUpdateId: 100 })
    mockCallIntelligence.mockResolvedValue(
      ok({ decision: "idle", reason: "test", confidence: 0.9, estimatedTokens: 0 })
    )

    await run()

    expect(mockStartNewConversation).toHaveBeenCalled()
  })

  it("processes triage → respond → send flow", async () => {
    mockFetchNewMessages.mockResolvedValueOnce({ messages: [makeTestMessage()], maxUpdateId: 100 })
    mockCallIntelligence
      .mockResolvedValueOnce(ok({ decision: "simple", reason: "greeting", confidence: 0.9, estimatedTokens: 100 }))
      .mockResolvedValueOnce(ok({ messages: [{ text: "Hi!" }], expectsReply: false }))

    const result = await run()

    expect(mockCallIntelligence).toHaveBeenCalledTimes(2)
    expect(mockSendMessageWithReply).toHaveBeenCalledWith("Hi!", undefined)
    expect(result).toEqual({ rounds: 1 })
  })

  it("handles follow-up loop when expectsReply is true", async () => {
    mockFetchNewMessages
      .mockResolvedValueOnce({ messages: [makeTestMessage({ text: "Hi" })], maxUpdateId: 100 })
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

    const result = await run()

    expect(mockFetchNewMessages).toHaveBeenCalledTimes(3)
    expect(mockFetchNewMessages).toHaveBeenNthCalledWith(2, 60)
    expect(result).toEqual({ rounds: 2 })
  })

  it("breaks on triage failure without stuck messages", async () => {
    mockFetchNewMessages.mockResolvedValueOnce({ messages: [makeTestMessage()], maxUpdateId: 100 })
    mockCallIntelligence.mockResolvedValue(err(animaError("LLM_ERROR", "triage failed")))

    const result = await run()

    expect(result).toEqual({ rounds: 1 })
    expect(mockSetLastUpdateId).toHaveBeenCalledWith(100)
    expect(mockCallIntelligence).toHaveBeenCalledTimes(1)
  })

  it("handles idle decision gracefully", async () => {
    mockFetchNewMessages.mockResolvedValueOnce({ messages: [makeTestMessage()], maxUpdateId: 100 })
    mockCallIntelligence.mockResolvedValue(
      ok({ decision: "idle", reason: "just an ack", confidence: 0.95, estimatedTokens: 0 })
    )

    const result = await run()

    expect(result).toEqual({ rounds: 1 })
    expect(mockCallIntelligence).toHaveBeenCalledTimes(1)
    expect(mockStoreEpisode).toHaveBeenCalledWith(
      expect.stringContaining("chose not to respond"),
      "interaction",
      expect.any(Object)
    )
  })

  it("splits paragraphs and sends them as separate messages", async () => {
    mockFetchNewMessages.mockResolvedValueOnce({ messages: [makeTestMessage()], maxUpdateId: 100 })
    mockCallIntelligence
      .mockResolvedValueOnce(ok({ decision: "simple", reason: "chat", confidence: 0.9, estimatedTokens: 100 }))
      .mockResolvedValueOnce(ok({ messages: [{ text: "First paragraph.\n\nSecond paragraph." }], expectsReply: false }))
    mockSplitIntoParagraphs.mockReturnValue(["First paragraph.", "Second paragraph."])

    await run()

    expect(mockSendMessageWithReply).toHaveBeenCalledTimes(2)
    expect(mockSendMessageWithReply).toHaveBeenNthCalledWith(1, "First paragraph.", undefined)
    expect(mockSendMessageWithReply).toHaveBeenNthCalledWith(2, "Second paragraph.", undefined)
  })

  it("includes messageId when pushing operator messages to buffer", async () => {
    mockFetchNewMessages.mockResolvedValueOnce({
      messages: [makeTestMessage({ messageId: 555 })],
      maxUpdateId: 100
    })
    mockCallIntelligence.mockResolvedValue(
      ok({ decision: "idle", reason: "test", confidence: 0.9, estimatedTokens: 0 })
    )

    await run()

    expect(mockPushToActiveConversation).toHaveBeenCalledWith([
      expect.objectContaining({ role: "operator", messageId: 555 })
    ])
  })

  it("includes sentMessageId when pushing ANIMA messages to buffer", async () => {
    mockFetchNewMessages.mockResolvedValueOnce({ messages: [makeTestMessage()], maxUpdateId: 100 })
    mockCallIntelligence
      .mockResolvedValueOnce(ok({ decision: "simple", reason: "chat", confidence: 0.9, estimatedTokens: 100 }))
      .mockResolvedValueOnce(ok({ messages: [{ text: "Hi!" }], expectsReply: false }))
    mockSendMessageWithReply.mockResolvedValue(999)

    await run()

    expect(mockPushToActiveConversation).toHaveBeenCalledWith([
      expect.objectContaining({ role: "anima", text: "Hi!", messageId: 999 })
    ])
  })

  it("checks for afterthought after main response", async () => {
    mockFetchNewMessages.mockResolvedValueOnce({ messages: [makeTestMessage()], maxUpdateId: 100 })
    mockCallIntelligence
      .mockResolvedValueOnce(ok({ decision: "simple", reason: "chat", confidence: 0.9, estimatedTokens: 100 }))
      .mockResolvedValueOnce(ok({ messages: [{ text: "Hello!" }], expectsReply: false }))

    await run()

    expect(mockCheckForAfterthought).toHaveBeenCalled()
  })

  it("sends afterthought message when checkForAfterthought returns a result", async () => {
    mockFetchNewMessages.mockResolvedValueOnce({ messages: [makeTestMessage()], maxUpdateId: 100 })
    mockCallIntelligence
      .mockResolvedValueOnce(ok({ decision: "simple", reason: "chat", confidence: 0.9, estimatedTokens: 100 }))
      .mockResolvedValueOnce(ok({ messages: [{ text: "Hello!" }], expectsReply: false }))
    mockCheckForAfterthought.mockResolvedValue({ text: "Oh wait, one more thing!", replyTo: 100 })
    mockSendMessageWithReply.mockResolvedValue(42)

    await run()

    expect(mockSendMessageWithReply).toHaveBeenCalledWith("Oh wait, one more thing!", 100)
    expect(mockStoreEpisode).toHaveBeenCalledWith(
      expect.stringContaining("Afterthought"),
      "interaction",
      expect.any(Object)
    )
  })

  it("ends conversation when follow-up poll times out", async () => {
    mockFetchNewMessages
      .mockResolvedValueOnce({ messages: [makeTestMessage()], maxUpdateId: 100 })
      .mockResolvedValueOnce({ messages: [], maxUpdateId: null })

    mockCallIntelligence
      .mockResolvedValueOnce(ok({ decision: "simple", reason: "chat", confidence: 0.9, estimatedTokens: 100 }))
      .mockResolvedValueOnce(ok({ messages: [{ text: "Sure!" }], expectsReply: true }))
    mockComputeFollowUpWait.mockReturnValue(120)

    const result = await run()

    expect(result).toEqual({ rounds: 1 })
    expect(mockFetchNewMessages).toHaveBeenNthCalledWith(2, 120)
  })
})
