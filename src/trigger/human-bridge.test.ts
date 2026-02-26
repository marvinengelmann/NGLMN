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

vi.mock("@/integrations/anthropic.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/integrations/anthropic.ts")>()),
  callClaude: vi.fn(),
  callClaudeWithUsage: vi.fn()
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
  parseStructuredResponse: vi.fn(),
  computeFollowUpWait: vi.fn()
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

vi.mock("@/core/model-router.ts", () => ({
  selectModel: vi.fn(() => "haiku"),
  getMaxTokensForTier: vi.fn(() => 200)
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
  saveEmotionalState: vi.fn()
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

import { computeFollowUpWait, parseStructuredResponse } from "@/bridge/handler.ts"
import { splitIntoParagraphs } from "@/bridge/typing.ts"
import { callClaude, callClaudeWithUsage } from "@/integrations/anthropic.ts"
import { fetchNewMessages, sendMessageWithReply } from "@/integrations/telegram.ts"
import { storeEpisode } from "@/memory/episodic.ts"
import {
  getActiveConversation,
  getConversationBuffer,
  setLastUpdateId,
  setOperatorLastActivity,
  startNewConversation
} from "@/memory/working.ts"
import { humanBridgeTask } from "./human-bridge.ts"

const mockFetchNewMessages = fetchNewMessages as ReturnType<typeof vi.fn>
const mockCallClaude = callClaude as ReturnType<typeof vi.fn>
const mockCallClaudeWithUsage = callClaudeWithUsage as ReturnType<typeof vi.fn>
const mockParseStructuredResponse = parseStructuredResponse as ReturnType<typeof vi.fn>
const mockComputeFollowUpWait = computeFollowUpWait as ReturnType<typeof vi.fn>
const mockGetActiveConversation = getActiveConversation as ReturnType<typeof vi.fn>
const mockGetConversationBuffer = getConversationBuffer as ReturnType<typeof vi.fn>
const mockSetLastUpdateId = setLastUpdateId as ReturnType<typeof vi.fn>
const mockSetOperatorLastActivity = setOperatorLastActivity as ReturnType<typeof vi.fn>
const mockStartNewConversation = startNewConversation as ReturnType<typeof vi.fn>
const mockSendMessageWithReply = sendMessageWithReply as ReturnType<typeof vi.fn>
const mockStoreEpisode = storeEpisode as ReturnType<typeof vi.fn>
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
    mockCallClaude.mockResolvedValue(ok('{"decision":"idle","reason":"test","confidence":0.9,"estimatedTokens":0}'))

    await run()

    expect(mockSetLastUpdateId).toHaveBeenCalledWith(100)
    expect(mockSetOperatorLastActivity).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}/))
  })

  it("creates new conversation slot when none exists", async () => {
    mockFetchNewMessages.mockResolvedValueOnce({ messages: [makeTestMessage()], maxUpdateId: 100 })
    mockCallClaude.mockResolvedValue(ok('{"decision":"idle","reason":"test","confidence":0.9,"estimatedTokens":0}'))

    await run()

    expect(mockStartNewConversation).toHaveBeenCalled()
  })

  it("processes triage → respond → send flow", async () => {
    mockFetchNewMessages.mockResolvedValueOnce({ messages: [makeTestMessage()], maxUpdateId: 100 })
    mockCallClaude.mockResolvedValue(
      ok('{"decision":"simple","reason":"greeting","confidence":0.9,"estimatedTokens":100}')
    )
    mockCallClaudeWithUsage.mockResolvedValue(
      ok({ text: '{"messages":[{"text":"Hi!"}],"expectsReply":false}', usage: { input: 10, output: 5 } })
    )
    mockParseStructuredResponse.mockReturnValue({
      messages: [{ text: "Hi!" }],
      expectsReply: false
    })

    const result = await run()

    expect(mockCallClaude).toHaveBeenCalled()
    expect(mockCallClaudeWithUsage).toHaveBeenCalled()
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

    mockCallClaude.mockResolvedValue(ok('{"decision":"simple","reason":"chat","confidence":0.9,"estimatedTokens":100}'))
    mockCallClaudeWithUsage.mockResolvedValue(ok({ text: "response", usage: { input: 10, output: 5 } }))
    mockParseStructuredResponse.mockReturnValue({
      messages: [{ text: "Hello!" }],
      expectsReply: true
    })
    mockComputeFollowUpWait.mockReturnValue(60)

    const result = await run()

    expect(mockFetchNewMessages).toHaveBeenCalledTimes(3)
    expect(mockFetchNewMessages).toHaveBeenNthCalledWith(2, 60)
    expect(result).toEqual({ rounds: 2 })
  })

  it("breaks on triage failure without stuck messages", async () => {
    mockFetchNewMessages.mockResolvedValueOnce({ messages: [makeTestMessage()], maxUpdateId: 100 })
    mockCallClaude.mockResolvedValue(err(animaError("ANTHROPIC_ERROR", "triage failed")))

    const result = await run()

    expect(result).toEqual({ rounds: 1 })
    expect(mockSetLastUpdateId).toHaveBeenCalledWith(100)
    expect(mockCallClaudeWithUsage).not.toHaveBeenCalled()
  })

  it("handles idle decision gracefully", async () => {
    mockFetchNewMessages.mockResolvedValueOnce({ messages: [makeTestMessage()], maxUpdateId: 100 })
    mockCallClaude.mockResolvedValue(
      ok('{"decision":"idle","reason":"just an ack","confidence":0.95,"estimatedTokens":0}')
    )

    const result = await run()

    expect(result).toEqual({ rounds: 1 })
    expect(mockCallClaudeWithUsage).not.toHaveBeenCalled()
    expect(mockStoreEpisode).toHaveBeenCalledWith(
      expect.stringContaining("chose not to respond"),
      "interaction",
      expect.any(Object)
    )
  })

  it("splits paragraphs and sends them as separate messages", async () => {
    mockFetchNewMessages.mockResolvedValueOnce({ messages: [makeTestMessage()], maxUpdateId: 100 })
    mockCallClaude.mockResolvedValue(ok('{"decision":"simple","reason":"chat","confidence":0.9,"estimatedTokens":100}'))
    mockCallClaudeWithUsage.mockResolvedValue(ok({ text: "response", usage: { input: 10, output: 5 } }))
    mockParseStructuredResponse.mockReturnValue({
      messages: [{ text: "First paragraph.\n\nSecond paragraph." }],
      expectsReply: false
    })
    mockSplitIntoParagraphs.mockReturnValue(["First paragraph.", "Second paragraph."])

    await run()

    expect(mockSendMessageWithReply).toHaveBeenCalledTimes(2)
    expect(mockSendMessageWithReply).toHaveBeenNthCalledWith(1, "First paragraph.", undefined)
    expect(mockSendMessageWithReply).toHaveBeenNthCalledWith(2, "Second paragraph.", undefined)
  })

  it("ends conversation when follow-up poll times out", async () => {
    mockFetchNewMessages
      .mockResolvedValueOnce({ messages: [makeTestMessage()], maxUpdateId: 100 })
      .mockResolvedValueOnce({ messages: [], maxUpdateId: null })

    mockCallClaude.mockResolvedValue(ok('{"decision":"simple","reason":"chat","confidence":0.9,"estimatedTokens":100}'))
    mockCallClaudeWithUsage.mockResolvedValue(ok({ text: "response", usage: { input: 10, output: 5 } }))
    mockParseStructuredResponse.mockReturnValue({
      messages: [{ text: "Sure!" }],
      expectsReply: true
    })
    mockComputeFollowUpWait.mockReturnValue(120)

    const result = await run()

    expect(result).toEqual({ rounds: 1 })
    expect(mockFetchNewMessages).toHaveBeenNthCalledWith(2, 120)
  })
})
