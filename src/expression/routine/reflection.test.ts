import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/affect/emotion/metrics.ts", () => ({
  collectMetrics: vi.fn().mockResolvedValue({ successRate: 0.9, errorRate: 0.1, tickCount: 50 })
}))
vi.mock("@/affect/emotion/state.ts", () => ({
  getEmotionalState: vi.fn(),
  getEmotionHistory: vi.fn().mockResolvedValue([]),
  processEmotionTrigger: vi.fn(),
  saveEmotionalState: vi.fn()
}))
vi.mock("@/cognition/learning/analysis.ts", () => ({
  analyzeStrategyPatterns: vi.fn().mockResolvedValue([])
}))
vi.mock("@/core/budget.ts", () => ({
  getBudgetState: vi.fn().mockResolvedValue({ consumedToday: 1.5 })
}))
vi.mock("@/expression/communication/patterns.ts", () => ({
  analyzeConversationPatterns: vi.fn().mockResolvedValue({ patterns: [], recurringUnresolved: [] })
}))
vi.mock("@/infra/db/client.ts", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([])
          })
        }),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([])
        })
      })
    })
  }
}))
vi.mock("@/infra/db/schema.ts", () => ({
  evolutionLog: { type: "type", description: "description", outcome: "outcome", createdAt: "createdAt" },
  tickLog: { createdAt: "createdAt" },
  interactionOutcomes: { tickId: "tickId" }
}))
vi.mock("@/infra/lib/logger.ts", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}))
vi.mock("@/infra/lib/result.ts", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/infra/lib/result.ts")>()
  return {
    ...original,
    logAndCaptureError: vi.fn()
  }
})
vi.mock("@/memory/consistency.ts", () => ({
  storeWithConsistencyCheck: vi.fn().mockResolvedValue(null)
}))
vi.mock("@/memory/episodic.ts", () => ({
  storeEpisode: vi.fn()
}))
vi.mock("@/memory/goals/conflicts.ts", () => ({
  detectGoalConflicts: vi.fn().mockResolvedValue([])
}))
vi.mock("@/memory/goals.ts", () => ({
  createGoal: vi.fn().mockResolvedValue({ isErr: () => false }),
  getActiveGoals: vi.fn().mockResolvedValue([])
}))
vi.mock("@/self/psyche/narrative.ts", () => ({
  generateIdentityStatements: vi.fn().mockResolvedValue([])
}))
vi.mock("@/self/psyche/questions.ts", () => ({
  addExistentialQuestion: vi.fn()
}))
vi.mock("@/self/psyche/state.ts", () => ({
  getSelfConcept: vi.fn().mockResolvedValue({}),
  getRecentNarratives: vi.fn().mockResolvedValue([]),
  saveIdentityStatements: vi.fn()
}))

import { storeWithConsistencyCheck } from "@/memory/consistency.ts"
import { applyReflectionResult } from "./reflection.ts"
import type { ReflectionOutput } from "./types.ts"

describe("applyReflectionResult", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("stores counterfactuals as semantic insights", async () => {
    const output: ReflectionOutput = {
      insights: [],
      existentialQuestions: [],
      counterfactuals: [
        {
          originalAction: "responded tersely",
          alternativeAction: "asked a follow-up question",
          expectedOutcome: "deeper conversation",
          lesson: "Short responses shut down conversations when the operator wants to talk"
        }
      ]
    }

    await applyReflectionResult(output)

    expect(storeWithConsistencyCheck).toHaveBeenCalledWith(
      "insight",
      expect.stringMatching(/^counterfactual-/),
      expect.stringContaining("responded tersely"),
      "reflection",
      0.75,
      "self"
    )
  })

  it("does not store counterfactuals when none provided", async () => {
    const output: ReflectionOutput = {
      insights: [],
      existentialQuestions: []
    }

    await applyReflectionResult(output)

    const calls = vi.mocked(storeWithConsistencyCheck).mock.calls
    const cfCalls = calls.filter((c) => typeof c[1] === "string" && c[1].startsWith("counterfactual-"))
    expect(cfCalls).toHaveLength(0)
  })

  it("stores multiple counterfactuals", async () => {
    const output: ReflectionOutput = {
      insights: [],
      existentialQuestions: [],
      counterfactuals: [
        {
          originalAction: "action1",
          alternativeAction: "alt1",
          expectedOutcome: "outcome1",
          lesson: "lesson1"
        },
        {
          originalAction: "action2",
          alternativeAction: "alt2",
          expectedOutcome: "outcome2",
          lesson: "lesson2"
        }
      ]
    }

    await applyReflectionResult(output)

    const calls = vi.mocked(storeWithConsistencyCheck).mock.calls
    const cfCalls = calls.filter((c) => typeof c[1] === "string" && c[1].startsWith("counterfactual-"))
    expect(cfCalls).toHaveLength(2)
  })
})
