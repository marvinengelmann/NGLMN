import { err, ok } from "neverthrow"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { EmotionTrigger } from "@/emotion/types.ts"
import { animaError } from "@/lib/errors.ts"
import type { GuardianResult } from "@/security/types.ts"
import type { ActionType } from "@/trust/types.ts"
import type { ChannelConfig } from "./processor.ts"

vi.mock("@/config/constants.ts", () => ({
  EMOTIONAL_THRESHOLDS: { TASK_FAILURE_INTENSITY: 0.6 }
}))

vi.mock("@/core/consciousness.ts", () => ({
  buildConsciousnessPrompt: vi.fn(() => "consciousness prompt")
}))

vi.mock("@/core/intelligence.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/core/intelligence.ts")>()),
  callIntelligence: vi.fn(),
  selectModel: vi.fn(() => "haiku"),
  getMaxTokensForTier: vi.fn(() => 2048)
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
  computeEmotionalUpdate: vi.fn((state: unknown) => state)
}))

vi.mock("@/evolution/prompt.ts", () => ({
  loadPrompt: vi.fn((_key: string, fallback: string) => fallback)
}))

vi.mock("@/integrations/telegram.ts", () => ({
  sendToOperator: vi.fn()
}))

vi.mock("@/lib/logger.ts", () => ({
  log: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() }
}))

vi.mock("@/lib/sentry.ts", () => ({
  captureError: vi.fn()
}))

vi.mock("@/memory/episodic.ts", () => ({
  storeEpisode: vi.fn()
}))

vi.mock("@/prompts/responder.ts", () => ({
  RESPONDER_SYSTEM_PROMPT: "mock responder prompt"
}))

vi.mock("@/security/guardian.ts", () => ({
  handleGuardianVerdict: vi.fn(() => ({ blocked: false }))
}))

vi.mock("@/trust/assessment.ts", () => ({
  canActAutonomously: vi.fn()
}))

vi.mock("@/trust/history.ts", () => ({
  recordFailure: vi.fn(),
  recordSuccess: vi.fn()
}))

import { callIntelligence } from "@/core/intelligence.ts"
import { processEmotionTrigger, saveEmotionalState } from "@/emotion/state.ts"
import { computeEmotionalUpdate } from "@/emotion/update.ts"
import { sendToOperator } from "@/integrations/telegram.ts"
import { captureError } from "@/lib/sentry.ts"
import { storeEpisode } from "@/memory/episodic.ts"
import { handleGuardianVerdict } from "@/security/guardian.ts"
import { canActAutonomously } from "@/trust/assessment.ts"
import { recordFailure, recordSuccess } from "@/trust/history.ts"
import { processInboundItems } from "./processor.ts"

const mockCallIntelligence = callIntelligence as ReturnType<typeof vi.fn>
const mockCanActAutonomously = canActAutonomously as ReturnType<typeof vi.fn>
const mockHandleGuardianVerdict = handleGuardianVerdict as ReturnType<typeof vi.fn>
const mockStoreEpisode = storeEpisode as ReturnType<typeof vi.fn>
const mockRecordSuccess = recordSuccess as ReturnType<typeof vi.fn>
const mockRecordFailure = recordFailure as ReturnType<typeof vi.fn>
const mockSendToOperator = sendToOperator as ReturnType<typeof vi.fn>
const mockSaveEmotionalState = saveEmotionalState as ReturnType<typeof vi.fn>
const mockComputeEmotionalUpdate = computeEmotionalUpdate as ReturnType<typeof vi.fn>
const mockProcessEmotionTrigger = processEmotionTrigger as ReturnType<typeof vi.fn>
const mockCaptureError = captureError as ReturnType<typeof vi.fn>

interface TestItem {
  id: string
  text: string
}

function makeMockConfig(overrides?: Partial<ChannelConfig<TestItem>>): ChannelConfig<TestItem> {
  return {
    channelName: "test",
    trustAction: "email_send" as ActionType,
    defaults: {
      triageDecision: "complex",
      triageConfidence: 0.8,
      triageEstimatedTokens: 500,
      relevanceScore: 0.8,
      trustBlockedRelevance: 0.8
    },
    fetchItems: vi.fn(() => Promise.resolve([{ id: "1", text: "hello" }])),
    clearItems: vi.fn(),
    requeueItems: vi.fn(),
    buildContext: vi.fn((_item, _prompt) => "test context"),
    validateResponse: vi.fn(() =>
      Promise.resolve({
        verdict: "approved",
        reasons: [],
        checkedAt: new Date().toISOString()
      } satisfies GuardianResult)
    ),
    sendResponse: vi.fn(() => Promise.resolve(true)),
    buildNotification: vi.fn(() => "notification"),
    buildEpisodeText: vi.fn(() => "episode text"),
    emotionTrigger: "email_sent" as EmotionTrigger,
    emotionIntensity: 0.7,
    ...overrides
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCanActAutonomously.mockResolvedValue({ canAct: true, reason: "trusted" })
  mockCallIntelligence.mockResolvedValue(ok({ text: "reply text" }))
  mockHandleGuardianVerdict.mockResolvedValue({ blocked: false })
})

describe("processInboundItems", () => {
  it("returns processed: 0 when fetchItems returns empty array", async () => {
    const config = makeMockConfig({ fetchItems: vi.fn(() => Promise.resolve([])) })

    const result = await processInboundItems(config)

    expect(result).toEqual({ processed: 0 })
    expect(mockCanActAutonomously).not.toHaveBeenCalled()
  })

  it("returns trust_blocked when canActAutonomously.canAct is false", async () => {
    mockCanActAutonomously.mockResolvedValue({ canAct: false, reason: "no experience" })
    const config = makeMockConfig()

    const result = await processInboundItems(config)

    expect(result).toEqual({ processed: 0, reason: "trust_blocked" })
    expect(mockStoreEpisode).toHaveBeenCalledWith(
      expect.stringContaining("Trust gate blocked"),
      "observation",
      expect.objectContaining({ relevanceScore: 0.8 })
    )
  })

  it("processes full happy path: intelligence → guardian → send → notification → episode → success", async () => {
    const config = makeMockConfig()

    const result = await processInboundItems(config)

    expect(result).toEqual({ processed: 1 })
    expect(mockCallIntelligence).toHaveBeenCalledTimes(1)
    expect(mockHandleGuardianVerdict).toHaveBeenCalledTimes(1)
    expect(config.sendResponse).toHaveBeenCalledWith({ id: "1", text: "hello" }, "reply text")
    expect(mockSendToOperator).toHaveBeenCalledWith("notification")
    expect(mockStoreEpisode).toHaveBeenCalledWith("episode text", "interaction", { relevanceScore: 0.8 })
    expect(mockRecordSuccess).toHaveBeenCalledWith("email_send")
    expect(config.clearItems).toHaveBeenCalledWith(1)
  })

  it("handles intelligence failure with emotion trigger and failed items", async () => {
    mockCallIntelligence.mockResolvedValue(err(animaError("LLM_ERROR", "model failed")))
    const config = makeMockConfig()

    const result = await processInboundItems(config)

    expect(result).toEqual({ processed: 0 })
    expect(mockProcessEmotionTrigger).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: "task_failure" }),
      "task_failure",
      expect.stringContaining("test-fail-")
    )
    expect(config.requeueItems).toHaveBeenCalledWith([{ id: "1", text: "hello" }])
  })

  it("handles guardian blocking", async () => {
    mockHandleGuardianVerdict.mockResolvedValue({ blocked: true })
    const config = makeMockConfig()

    const result = await processInboundItems(config)

    expect(result).toEqual({ processed: 0 })
    expect(config.sendResponse).not.toHaveBeenCalled()
    expect(config.requeueItems).toHaveBeenCalledWith([{ id: "1", text: "hello" }])
  })

  it("handles sendResponse failure", async () => {
    const config = makeMockConfig({
      sendResponse: vi.fn(() => Promise.resolve(false))
    })

    const result = await processInboundItems(config)

    expect(result).toEqual({ processed: 0 })
    expect(mockSendToOperator).not.toHaveBeenCalled()
    expect(config.requeueItems).toHaveBeenCalledWith([{ id: "1", text: "hello" }])
  })

  it("handles partial success: 2 items, 1 fails", async () => {
    const items: TestItem[] = [
      { id: "1", text: "hello" },
      { id: "2", text: "world" }
    ]
    mockCallIntelligence
      .mockResolvedValueOnce(ok({ text: "reply 1" }))
      .mockResolvedValueOnce(err(animaError("LLM_ERROR", "fail")))

    const config = makeMockConfig({ fetchItems: vi.fn(() => Promise.resolve(items)) })

    const result = await processInboundItems(config)

    expect(result).toEqual({ processed: 1 })
    expect(config.requeueItems).toHaveBeenCalledWith([{ id: "2", text: "world" }])
    expect(mockRecordSuccess).toHaveBeenCalledTimes(1)
  })

  it("updates emotion only when processed > 0", async () => {
    mockCallIntelligence.mockResolvedValue(err(animaError("LLM_ERROR", "fail")))
    const config = makeMockConfig()

    await processInboundItems(config)

    expect(mockComputeEmotionalUpdate).not.toHaveBeenCalled()
    expect(mockSaveEmotionalState).not.toHaveBeenCalled()
  })

  it("updates emotion when items are processed successfully", async () => {
    const config = makeMockConfig()

    await processInboundItems(config)

    expect(mockComputeEmotionalUpdate).toHaveBeenCalledTimes(1)
    expect(mockSaveEmotionalState).toHaveBeenCalledTimes(1)
  })

  it("catches exceptions in loop and records failure", async () => {
    const error = new Error("unexpected crash")
    mockCallIntelligence.mockRejectedValue(error)
    const config = makeMockConfig()

    const result = await processInboundItems(config)

    expect(result).toEqual({ processed: 0 })
    expect(mockCaptureError).toHaveBeenCalledWith(error, { phase: "test_handler" })
    expect(mockRecordFailure).toHaveBeenCalledWith("email_send")
  })
})
