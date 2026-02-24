import { describe, expect, it, vi } from "vitest"

vi.mock("@trigger.dev/sdk", () => ({
  task: vi.fn((config: Record<string, unknown>) => ({ ...config, trigger: vi.fn() })),
  wait: { forToken: vi.fn(), completeToken: vi.fn() }
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
  callClaudeWithUsage: vi.fn(),
  stripCodeFences: vi.fn((text: string) => text)
}))

vi.mock("@/integrations/telegram.ts", () => ({
  sendMessageWithReply: vi.fn(),
  sendTypingAction: vi.fn(),
  sendToOperator: vi.fn(),
  sendGuardianAlert: vi.fn()
}))

vi.mock("@/memory/working.ts", () => ({
  peekAllPendingMessages: vi.fn(),
  clearPendingMessages: vi.fn(),
  getConversationHistory: vi.fn(),
  pushConversationMessage: vi.fn(),
  pushRecentResponse: vi.fn(),
  setGuardianResult: vi.fn(),
  setConversationWaitToken: vi.fn(),
  clearConversationWaitToken: vi.fn()
}))

vi.mock("@/bridge/handler.ts", () => ({
  buildConversationResponsePrompt: vi.fn(),
  parseStructuredResponse: vi.fn(),
  computeFollowUpWait: vi.fn()
}))

vi.mock("@/bridge/conversation.ts", () => ({
  detectConversationBoundary: vi.fn(),
  archiveConversation: vi.fn()
}))

vi.mock("@/bridge/typing.ts", () => ({
  computeTypingDuration: vi.fn(() => 0),
  computeReadTime: vi.fn(() => 0),
  simulateTyping: vi.fn()
}))

vi.mock("@/security/guardian.ts", () => ({
  validateOutput: vi.fn()
}))

vi.mock("@/core/model-router.ts", () => ({
  getModelForPhase: vi.fn(() => "haiku"),
  selectModel: vi.fn(() => "haiku"),
  getMaxTokensForTier: vi.fn(() => 200)
}))

vi.mock("@/prompts/triage.ts", () => ({
  TRIAGE_SYSTEM_PROMPT: "mock triage prompt"
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

vi.mock("@/core/context-builder.ts", () => ({
  buildTriageContext: vi.fn(() => ({
    now: new Date().toISOString(),
    lastTick: null,
    userPrompt: "test"
  }))
}))

vi.mock("@/memory/episodic.ts", () => ({
  storeEpisode: vi.fn(),
  storeRelationshipEpisode: vi.fn()
}))

import { conversationHandlerTask } from "./conversation-handler.ts"

describe("conversation-handler", () => {
  it("exports a task with the conversation-handler id", () => {
    expect(conversationHandlerTask).toBeDefined()
    expect((conversationHandlerTask as unknown as Record<string, unknown>).id).toBe("conversation-handler")
  })

  it("uses concurrency limit of 1", () => {
    expect((conversationHandlerTask as unknown as Record<string, unknown>).queue).toEqual({ concurrencyLimit: 1 })
  })

  it("has maxDuration of 300 seconds", () => {
    expect((conversationHandlerTask as unknown as Record<string, unknown>).maxDuration).toBe(300)
  })

  it("has a run function", () => {
    expect(typeof (conversationHandlerTask as unknown as Record<string, unknown>).run).toBe("function")
  })
})
