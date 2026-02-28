import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/logger.ts", () => ({
  log: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() }
}))

vi.mock("@/lib/sentry.ts", () => ({
  setTickContext: vi.fn()
}))

vi.mock("@/core/workflow.ts", () => ({
  executeWorkflow: vi.fn(() => ({ success: true }))
}))

vi.mock("@/core/intelligence.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/core/intelligence.ts")>()),
  callIntelligence: vi.fn()
}))

vi.mock("@/memory/working.ts", () => ({
  pushRecentResponse: vi.fn(),
  pushToActiveConversation: vi.fn(),
  setGuardianResult: vi.fn(),
  setLastProactiveAction: vi.fn()
}))

vi.mock("@/core/context.ts", () => ({
  buildSimpleContext: vi.fn(() => "simple context"),
  buildComplexContext: vi.fn(() => "complex context"),
  buildDeepContext: vi.fn(() => "deep context")
}))

vi.mock("@/prompts/proactive.ts", () => ({
  PROACTIVE_SYSTEM_PROMPT: "mock proactive prompt"
}))

vi.mock("@/evolution/prompt.ts", () => ({
  loadPrompt: vi.fn((_key: string, fallback: string) => fallback)
}))

vi.mock("@/integrations/telegram.ts", () => ({
  sendToOperator: vi.fn(() => 42),
  sendGuardianAlert: vi.fn()
}))

vi.mock("@/memory/episodic.ts", () => ({
  storeEpisode: vi.fn(),
  storeRelationshipEpisode: vi.fn()
}))

vi.mock("@/security/guardian.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/security/guardian.ts")>()
  return {
    ...actual,
    validateOutput: vi.fn()
  }
})

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
  computeEmotionalUpdate: vi.fn(() => ({
    curiosity: 0.5,
    satisfaction: 0.5,
    frustration: 0.1,
    boredom: 0.3,
    excitement: 0.5,
    caution: 0.5,
    connection: 0.5
  }))
}))

vi.mock("@/memory/goals.ts", async () => {
  const z = await import("zod")
  return {
    updateGoalStatus: vi.fn(),
    GoalStatus: z.enum(["open", "active", "paused", "done", "failed"])
  }
})

import { ok } from "neverthrow"
import { callIntelligence } from "@/core/intelligence.ts"
import { processEmotionTrigger, saveEmotionalState } from "@/emotion/state.ts"
import { computeEmotionalUpdate } from "@/emotion/update.ts"
import { sendGuardianAlert, sendToOperator } from "@/integrations/telegram.ts"
import { storeEpisode, storeRelationshipEpisode } from "@/memory/episodic.ts"
import { updateGoalStatus } from "@/memory/goals.ts"
import { pushRecentResponse, setLastProactiveAction } from "@/memory/working.ts"
import { validateOutput } from "@/security/guardian.ts"
import { makeEmotionalState, makeGuardianResult, makePerceptionSummary, makeTriageResult } from "@/test/factories.ts"
import { act } from "./act.ts"
import type { SenseResult, TickContext } from "./sense.ts"
import type { ThinkResult } from "./think.ts"

const mockCallIntelligence = callIntelligence as ReturnType<typeof vi.fn>
const mockSaveEmotionalState = saveEmotionalState as ReturnType<typeof vi.fn>
const mockProcessEmotionTrigger = processEmotionTrigger as ReturnType<typeof vi.fn>
const mockComputeEmotionalUpdate = computeEmotionalUpdate as ReturnType<typeof vi.fn>
const mockValidateOutput = validateOutput as ReturnType<typeof vi.fn>
const mockSendToOperator = sendToOperator as ReturnType<typeof vi.fn>
const mockSendGuardianAlert = sendGuardianAlert as ReturnType<typeof vi.fn>
const mockPushRecentResponse = pushRecentResponse as ReturnType<typeof vi.fn>
const mockSetLastProactiveAction = setLastProactiveAction as ReturnType<typeof vi.fn>
const mockStoreEpisode = storeEpisode as ReturnType<typeof vi.fn>
const mockStoreRelationshipEpisode = storeRelationshipEpisode as ReturnType<typeof vi.fn>
const mockUpdateGoalStatus = updateGoalStatus as ReturnType<typeof vi.fn>

const ctx: TickContext = {
  tickId: "tick-test",
  startTime: Date.now(),
  timestamp: new Date().toISOString()
}

const senseResult: SenseResult = {
  perception: makePerceptionSummary(),
  emotion: makeEmotionalState()
}

describe("act phase", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns responseSent false and saves idle emotion on idle decision", async () => {
    const thinkResult: ThinkResult = {
      triageResult: makeTriageResult({ decision: "idle" }),
      consciousnessPrompt: "personality",
      triggeredWorkflows: []
    }

    const result = await act(ctx, senseResult, thinkResult)

    expect(result.responseSent).toBe(false)
    expect(mockSaveEmotionalState).toHaveBeenCalledWith(expect.anything(), "idle_tick", "tick-test")
    expect(mockComputeEmotionalUpdate).toHaveBeenCalledWith(senseResult.emotion, [
      { trigger: "idle_tick", intensity: 0.5 }
    ])
  })

  it("sends message to operator when guardian approves", async () => {
    const thinkResult: ThinkResult = {
      triageResult: makeTriageResult({ decision: "simple" }),
      consciousnessPrompt: "personality",
      triggeredWorkflows: []
    }

    mockCallIntelligence.mockResolvedValue(ok({ action: "message_operator", content: "Hello operator!" }))
    mockValidateOutput.mockResolvedValue(makeGuardianResult({ verdict: "approved" }))

    const result = await act(ctx, senseResult, thinkResult)

    expect(result.responseSent).toBe(true)
    expect(result.responseText).toBe("Hello operator!")
    expect(mockSendToOperator).toHaveBeenCalledWith("Hello operator!")
    expect(mockPushRecentResponse).toHaveBeenCalledWith("Hello operator!")
  })

  it("blocks message when guardian blocks", async () => {
    const thinkResult: ThinkResult = {
      triageResult: makeTriageResult({ decision: "simple" }),
      consciousnessPrompt: "personality",
      triggeredWorkflows: []
    }

    mockCallIntelligence.mockResolvedValue(ok({ action: "message_operator", content: "bad content" }))
    mockValidateOutput.mockResolvedValue(makeGuardianResult({ verdict: "blocked", reasons: ["unsafe"] }))

    const result = await act(ctx, senseResult, thinkResult)

    expect(result.responseSent).toBe(false)
    expect(mockSendGuardianAlert).toHaveBeenCalled()
    expect(mockSendToOperator).not.toHaveBeenCalled()
  })

  it("stores reflection episode", async () => {
    const thinkResult: ThinkResult = {
      triageResult: makeTriageResult({ decision: "complex" }),
      consciousnessPrompt: "personality",
      triggeredWorkflows: []
    }

    mockCallIntelligence.mockResolvedValue(ok({ action: "reflect", content: "I noticed a pattern..." }))

    await act(ctx, senseResult, thinkResult)

    expect(mockStoreEpisode).toHaveBeenCalledWith("I noticed a pattern...", "observation", {
      relevanceScore: 0.7,
      tickId: "tick-test"
    })
  })

  it("updates goal status when provided", async () => {
    const thinkResult: ThinkResult = {
      triageResult: makeTriageResult({ decision: "simple" }),
      consciousnessPrompt: "personality",
      triggeredWorkflows: []
    }

    mockCallIntelligence.mockResolvedValue(
      ok({
        action: "update_goal",
        goalId: "goal-123",
        goalStatus: "done"
      })
    )

    await act(ctx, senseResult, thinkResult)

    expect(mockUpdateGoalStatus).toHaveBeenCalledWith("goal-123", "done")
  })

  it("does nothing on action nothing", async () => {
    const thinkResult: ThinkResult = {
      triageResult: makeTriageResult({ decision: "simple" }),
      consciousnessPrompt: "personality",
      triggeredWorkflows: []
    }

    mockCallIntelligence.mockResolvedValue(ok({ action: "nothing" }))

    const result = await act(ctx, senseResult, thinkResult)

    expect(result.responseSent).toBe(false)
    expect(mockSendToOperator).not.toHaveBeenCalled()
    expect(mockSetLastProactiveAction).not.toHaveBeenCalled()
  })

  it("stores relationship episode when connection > 0.6 and response sent", async () => {
    const highConnectionSense: SenseResult = {
      perception: makePerceptionSummary(),
      emotion: makeEmotionalState({ connection: 0.8 })
    }
    const thinkResult: ThinkResult = {
      triageResult: makeTriageResult({ decision: "simple" }),
      consciousnessPrompt: "personality",
      triggeredWorkflows: []
    }

    mockCallIntelligence.mockResolvedValue(ok({ action: "message_operator", content: "warm message" }))
    mockValidateOutput.mockResolvedValue(makeGuardianResult({ verdict: "approved" }))

    await act(ctx, highConnectionSense, thinkResult)

    expect(mockStoreRelationshipEpisode).toHaveBeenCalled()
  })

  it("stores regular episode when connection <= 0.6", async () => {
    const lowConnectionSense: SenseResult = {
      perception: makePerceptionSummary(),
      emotion: makeEmotionalState({ connection: 0.4 })
    }
    const thinkResult: ThinkResult = {
      triageResult: makeTriageResult({ decision: "simple" }),
      consciousnessPrompt: "personality",
      triggeredWorkflows: []
    }

    mockCallIntelligence.mockResolvedValue(ok({ action: "message_operator", content: "hello" }))
    mockValidateOutput.mockResolvedValue(makeGuardianResult({ verdict: "approved" }))

    await act(ctx, lowConnectionSense, thinkResult)

    expect(mockStoreRelationshipEpisode).not.toHaveBeenCalled()
    expect(mockStoreEpisode).toHaveBeenCalled()
  })

  it("emits guardian_block emotion when message is blocked", async () => {
    const thinkResult: ThinkResult = {
      triageResult: makeTriageResult({ decision: "simple" }),
      consciousnessPrompt: "personality",
      triggeredWorkflows: []
    }

    mockCallIntelligence.mockResolvedValue(ok({ action: "message_operator", content: "bad content" }))
    mockValidateOutput.mockResolvedValue(makeGuardianResult({ verdict: "blocked", reasons: ["unsafe"] }))

    await act(ctx, senseResult, thinkResult)

    expect(mockProcessEmotionTrigger).toHaveBeenCalledWith(
      { trigger: "guardian_block", intensity: 0.8 },
      "guardian_block",
      expect.stringContaining("guardian-")
    )
  })

  it("emits guardian_warning emotion on warning", async () => {
    const thinkResult: ThinkResult = {
      triageResult: makeTriageResult({ decision: "simple" }),
      consciousnessPrompt: "personality",
      triggeredWorkflows: []
    }

    mockCallIntelligence.mockResolvedValue(ok({ action: "message_operator", content: "edgy content" }))
    mockValidateOutput.mockResolvedValue(makeGuardianResult({ verdict: "warning", reasons: ["tone"] }))

    await act(ctx, senseResult, thinkResult)

    expect(mockProcessEmotionTrigger).toHaveBeenCalledWith(
      { trigger: "guardian_warning", intensity: 0.6 },
      "guardian_warning",
      expect.stringContaining("guardian-")
    )
  })

  it("emits goal_completed emotion when goal status is done", async () => {
    const thinkResult: ThinkResult = {
      triageResult: makeTriageResult({ decision: "simple" }),
      consciousnessPrompt: "personality",
      triggeredWorkflows: []
    }

    mockCallIntelligence.mockResolvedValue(ok({ action: "update_goal", goalId: "goal-123", goalStatus: "done" }))

    await act(ctx, senseResult, thinkResult)

    expect(mockProcessEmotionTrigger).toHaveBeenCalledWith(
      { trigger: "goal_completed", intensity: 0.7 },
      "goal_completed",
      "goal-goal-123"
    )
  })

  it("emits goal_failed emotion when goal status is failed", async () => {
    const thinkResult: ThinkResult = {
      triageResult: makeTriageResult({ decision: "simple" }),
      consciousnessPrompt: "personality",
      triggeredWorkflows: []
    }

    mockCallIntelligence.mockResolvedValue(ok({ action: "update_goal", goalId: "goal-456", goalStatus: "failed" }))

    await act(ctx, senseResult, thinkResult)

    expect(mockProcessEmotionTrigger).toHaveBeenCalledWith(
      { trigger: "goal_failed", intensity: 0.6 },
      "goal_failed",
      "goal-goal-456"
    )
  })

  it("emits task_failure emotion when proactive call fails", async () => {
    const thinkResult: ThinkResult = {
      triageResult: makeTriageResult({ decision: "simple" }),
      consciousnessPrompt: "personality",
      triggeredWorkflows: []
    }

    mockCallIntelligence.mockResolvedValue({ isErr: () => true, error: { message: "api down" } } as never)

    await act(ctx, senseResult, thinkResult)

    expect(mockProcessEmotionTrigger).toHaveBeenCalledWith(
      { trigger: "task_failure", intensity: 0.6 },
      "task_failure",
      "tick-test"
    )
  })

  it("saves message_sent emotion when response is sent", async () => {
    const thinkResult: ThinkResult = {
      triageResult: makeTriageResult({ decision: "simple" }),
      consciousnessPrompt: "personality",
      triggeredWorkflows: []
    }

    mockCallIntelligence.mockResolvedValue(ok({ action: "message_operator", content: "hi!" }))
    mockValidateOutput.mockResolvedValue(makeGuardianResult({ verdict: "approved" }))

    await act(ctx, senseResult, thinkResult)

    expect(mockComputeEmotionalUpdate).toHaveBeenCalledWith(senseResult.emotion, [
      { trigger: "message_sent", intensity: 0.7 }
    ])
    expect(mockSaveEmotionalState).toHaveBeenCalledWith(expect.anything(), "message_sent", "tick-test")
  })
})
