import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/logger.ts", () => ({
  log: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() }
}))

vi.mock("@/lib/sentry.ts", () => ({
  setEmotionContext: vi.fn(),
  captureError: vi.fn()
}))

vi.mock("@/perception/evaluate.ts", () => ({
  evaluatePerception: vi.fn()
}))

vi.mock("@/emotion/state.ts", () => ({
  getEmotionalState: vi.fn(),
  saveEmotionalState: vi.fn()
}))

vi.mock("@/emotion/update.ts", () => ({
  computeEmotionalUpdate: vi.fn()
}))

vi.mock("@/perception/goals.ts", () => ({
  detectPerceptionGoals: vi.fn()
}))

import { getEmotionalState, saveEmotionalState } from "@/emotion/state.ts"
import { computeEmotionalUpdate } from "@/emotion/update.ts"
import { setEmotionContext } from "@/lib/sentry.ts"
import { evaluatePerception } from "@/perception/evaluate.ts"
import { detectPerceptionGoals } from "@/perception/goals.ts"
import { makeEmotionalState, makePerceptionSummary } from "@/test/factories.ts"
import type { TickContext } from "./sense.ts"
import { sense } from "./sense.ts"

const mockEvaluatePerception = evaluatePerception as ReturnType<typeof vi.fn>
const mockGetEmotionalState = getEmotionalState as ReturnType<typeof vi.fn>
const mockSaveEmotionalState = saveEmotionalState as ReturnType<typeof vi.fn>
const mockComputeEmotionalUpdate = computeEmotionalUpdate as ReturnType<typeof vi.fn>
const mockDetectPerceptionGoals = detectPerceptionGoals as ReturnType<typeof vi.fn>
const mockSetEmotionContext = setEmotionContext as ReturnType<typeof vi.fn>

const ctx: TickContext = {
  tickId: "tick-test",
  startTime: Date.now(),
  timestamp: new Date().toISOString()
}

describe("sense phase", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("evaluates perception and updates emotion", async () => {
    const perception = makePerceptionSummary()
    const currentEmotion = makeEmotionalState()
    const updatedEmotion = makeEmotionalState({ curiosity: 0.8 })

    mockEvaluatePerception.mockResolvedValue(perception)
    mockGetEmotionalState.mockResolvedValue(currentEmotion)
    mockComputeEmotionalUpdate.mockReturnValue(updatedEmotion)
    mockDetectPerceptionGoals.mockResolvedValue(0)

    const result = await sense(ctx)

    expect(result.perception).toEqual(perception)
    expect(result.emotion).toEqual(updatedEmotion)
    expect(mockComputeEmotionalUpdate).toHaveBeenCalledWith(currentEmotion, [{ trigger: "tick_start", intensity: 0.5 }])
  })

  it("saves emotional state to Redis", async () => {
    const perception = makePerceptionSummary()
    const updatedEmotion = makeEmotionalState()

    mockEvaluatePerception.mockResolvedValue(perception)
    mockGetEmotionalState.mockResolvedValue(makeEmotionalState())
    mockComputeEmotionalUpdate.mockReturnValue(updatedEmotion)
    mockDetectPerceptionGoals.mockResolvedValue(0)

    await sense(ctx)

    expect(mockSaveEmotionalState).toHaveBeenCalledWith(updatedEmotion, "tick_start", "tick-test")
  })

  it("sets Sentry emotion context", async () => {
    const updatedEmotion = makeEmotionalState({ excitement: 0.9 })

    mockEvaluatePerception.mockResolvedValue(makePerceptionSummary())
    mockGetEmotionalState.mockResolvedValue(makeEmotionalState())
    mockComputeEmotionalUpdate.mockReturnValue(updatedEmotion)
    mockDetectPerceptionGoals.mockResolvedValue(0)

    await sense(ctx)

    expect(mockSetEmotionContext).toHaveBeenCalledWith(updatedEmotion)
  })

  it("creates perception goals when count > 0", async () => {
    mockEvaluatePerception.mockResolvedValue(makePerceptionSummary())
    mockGetEmotionalState.mockResolvedValue(makeEmotionalState())
    mockComputeEmotionalUpdate.mockReturnValue(makeEmotionalState())
    mockDetectPerceptionGoals.mockResolvedValue(2)

    const result = await sense(ctx)

    expect(mockDetectPerceptionGoals).toHaveBeenCalled()
    expect(result.perception).toBeDefined()
  })

  it("catches perception goal detection errors gracefully", async () => {
    mockEvaluatePerception.mockResolvedValue(makePerceptionSummary())
    mockGetEmotionalState.mockResolvedValue(makeEmotionalState())
    mockComputeEmotionalUpdate.mockReturnValue(makeEmotionalState())
    mockDetectPerceptionGoals.mockRejectedValue(new Error("goal detection failed"))

    const result = await sense(ctx)

    expect(result.perception).toBeDefined()
    expect(result.emotion).toBeDefined()
  })

  it("includes perception emotional triggers in emotion computation", async () => {
    const triggers = [{ trigger: "perception_positive" as const, intensity: 0.8 }]
    const perception = makePerceptionSummary({ emotionalTriggers: triggers })

    mockEvaluatePerception.mockResolvedValue(perception)
    mockGetEmotionalState.mockResolvedValue(makeEmotionalState())
    mockComputeEmotionalUpdate.mockReturnValue(makeEmotionalState())
    mockDetectPerceptionGoals.mockResolvedValue(0)

    await sense(ctx)

    expect(mockComputeEmotionalUpdate).toHaveBeenCalledWith(expect.anything(), [
      { trigger: "tick_start", intensity: 0.5 },
      { trigger: "perception_positive", intensity: 0.8 }
    ])
  })
})
