vi.mock("@/core/intelligence.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/core/intelligence.ts")>()),
  callIntelligence: vi.fn()
}))

vi.mock("@/integrations/telegram.ts", () => ({
  sendToOperator: vi.fn(() => 42)
}))

vi.mock("@/emotion/state.ts", () => ({
  getEmotionalState: vi.fn(),
  saveEmotionalState: vi.fn()
}))

vi.mock("@/emotion/calibration.ts", () => ({
  metricsRecalibration: vi.fn((e: Record<string, number>) => e),
  morningRecalibration: vi.fn((e: Record<string, number>) => e)
}))

vi.mock("@/emotion/metrics.ts", () => ({
  collectMetrics: vi.fn()
}))

vi.mock("@/core/consciousness.ts", () => ({
  buildConsciousnessPrompt: vi.fn(() => Promise.resolve("[IDENTITY]\nTest identity\n\n[PERSONALITY & MOOD]\nBe warm."))
}))

vi.mock("@/memory/working.ts", () => ({
  getDreamInsights: vi.fn(),
  clearDreamInsights: vi.fn(),
  pushToActiveConversation: vi.fn(),
  setDreamState: vi.fn()
}))

vi.mock("@/memory/episodic.ts", () => ({
  storeEpisode: vi.fn()
}))

vi.mock("@/memory/semantic.ts", () => ({
  getOperatorLanguage: vi.fn(() => "German")
}))

vi.mock("@/lib/sentry.ts", () => ({
  captureError: vi.fn()
}))

vi.mock("./reflection.ts", () => ({
  runReflection: vi.fn()
}))

import { ok } from "neverthrow"
import { callIntelligence } from "@/core/intelligence.ts"
import { metricsRecalibration, morningRecalibration } from "@/emotion/calibration.ts"
import { collectMetrics } from "@/emotion/metrics.ts"
import { getEmotionalState, saveEmotionalState } from "@/emotion/state.ts"
import { sendToOperator } from "@/integrations/telegram.ts"
import { storeEpisode } from "@/memory/episodic.ts"
import { clearDreamInsights, getDreamInsights, pushToActiveConversation, setDreamState } from "@/memory/working.ts"
import { makeEmotionalState, makeMetricsSnapshot } from "@/test/factories.ts"
import { composeMorningMessage, runMorningRoutine, sendMorningMessage } from "./morning.ts"
import { runReflection } from "./reflection.ts"

const mockCallIntelligence = callIntelligence as ReturnType<typeof vi.fn>
const mockSendToOperator = sendToOperator as ReturnType<typeof vi.fn>
const mockGetEmotionalState = getEmotionalState as ReturnType<typeof vi.fn>
const mockSaveEmotionalState = saveEmotionalState as ReturnType<typeof vi.fn>
const mockGetDreamInsights = getDreamInsights as ReturnType<typeof vi.fn>
const mockClearDreamInsights = clearDreamInsights as ReturnType<typeof vi.fn>
const mockPushToActiveConversation = pushToActiveConversation as ReturnType<typeof vi.fn>
const mockStoreEpisode = storeEpisode as ReturnType<typeof vi.fn>
const mockSetDreamState = setDreamState as ReturnType<typeof vi.fn>
const mockCollectMetrics = collectMetrics as ReturnType<typeof vi.fn>
const mockMetricsRecalibration = metricsRecalibration as ReturnType<typeof vi.fn>
const mockMorningRecalibration = morningRecalibration as ReturnType<typeof vi.fn>
const mockRunReflection = runReflection as ReturnType<typeof vi.fn>

beforeEach(() => {
  mockGetDreamInsights.mockResolvedValue(["Insight from dreams"])
  mockGetEmotionalState.mockResolvedValue(makeEmotionalState())
  mockCallIntelligence.mockResolvedValue(ok({ text: "Good morning! Last night I thought about many things..." }))
  mockSendToOperator.mockResolvedValue(undefined)
  mockStoreEpisode.mockResolvedValue("ep-id")
  mockClearDreamInsights.mockResolvedValue(undefined)
  mockPushToActiveConversation.mockResolvedValue(undefined)
  mockSetDreamState.mockResolvedValue(undefined)
  mockCollectMetrics.mockResolvedValue(makeMetricsSnapshot())
  mockMetricsRecalibration.mockImplementation((e: Record<string, number>) => e)
  mockMorningRecalibration.mockImplementation((e: Record<string, number>) => e)
  mockSaveEmotionalState.mockResolvedValue(undefined)
  mockRunReflection.mockResolvedValue({ reason: "morning", output: { insights: [] } })
})

describe("composeMorningMessage", () => {
  it("generates a morning message using dream insights and personality", async () => {
    const message = await composeMorningMessage()

    expect(message).toBe("Good morning! Last night I thought about many things...")
    expect(mockCallIntelligence).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining("PERSONALITY & MOOD")
      })
    )
  })

  it("handles missing dream insights gracefully", async () => {
    mockGetDreamInsights.mockResolvedValue(null)
    const message = await composeMorningMessage()
    expect(message).toBeDefined()
  })
})

describe("sendMorningMessage", () => {
  it("sends to operator and stores in memory", async () => {
    await sendMorningMessage()

    expect(mockSendToOperator).toHaveBeenCalledWith("Good morning! Last night I thought about many things...")
    expect(mockStoreEpisode).toHaveBeenCalledWith(expect.stringContaining("Morning message sent"), "interaction", {
      relevanceScore: 0.8
    })
    expect(mockPushToActiveConversation).toHaveBeenCalledWith([
      expect.objectContaining({
        role: "anima",
        text: "Good morning! Last night I thought about many things..."
      })
    ])
  })

  it("clears dream insights after sending", async () => {
    await sendMorningMessage()
    expect(mockClearDreamInsights).toHaveBeenCalled()
  })
})

describe("runMorningRoutine", () => {
  it("completes the full pipeline successfully", async () => {
    const result = await runMorningRoutine()

    expect(result.action).toBe("completed")
    expect(mockGetEmotionalState).toHaveBeenCalled()
    expect(mockCollectMetrics).toHaveBeenCalled()
    expect(mockMetricsRecalibration).toHaveBeenCalled()
    expect(mockMorningRecalibration).toHaveBeenCalled()
    expect(mockSaveEmotionalState).toHaveBeenCalled()
    expect(mockRunReflection).toHaveBeenCalledWith("morning")
    expect(mockSetDreamState).toHaveBeenCalledWith("idle")
  })

  it("continues when recalibration fails", async () => {
    mockGetEmotionalState.mockRejectedValueOnce(new Error("redis down"))

    const result = await runMorningRoutine()

    expect(result.action).toBe("completed")
    expect(mockRunReflection).toHaveBeenCalled()
    expect(mockSetDreamState).toHaveBeenCalledWith("idle")
  })

  it("continues when reflection fails", async () => {
    mockRunReflection.mockRejectedValue(new Error("reflection boom"))

    const result = await runMorningRoutine()

    expect(result.action).toBe("completed")
    expect(mockSetDreamState).toHaveBeenCalledWith("idle")
  })

  it("resets dream state even when morning message fails", async () => {
    mockCallIntelligence.mockRejectedValue(new Error("LLM down"))

    const result = await runMorningRoutine()

    expect(result.action).toBe("completed")
    expect(mockSetDreamState).toHaveBeenCalledWith("idle")
  })

  it("calls runReflection with 'morning' reason", async () => {
    await runMorningRoutine()

    expect(mockRunReflection).toHaveBeenCalledWith("morning")
  })
})
