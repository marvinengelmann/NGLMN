vi.mock("@/db/client.ts", () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.insert = vi.fn().mockReturnValue(chain)
  chain.update = vi.fn().mockReturnValue(chain)
  chain.set = vi.fn().mockReturnValue(chain)
  chain.values = vi.fn().mockResolvedValue([])
  chain.returning = vi.fn().mockResolvedValue([{ id: "wf-1" }])
  chain.from = vi.fn().mockReturnValue(chain)
  chain.where = vi.fn().mockReturnValue(chain)
  chain.orderBy = vi.fn().mockReturnValue(chain)
  chain.limit = vi.fn().mockResolvedValue([])
  return { db: chain }
})

vi.mock("@/integrations/anthropic.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/integrations/anthropic.ts")>()),
  callClaude: vi.fn()
}))

vi.mock("@/integrations/telegram.ts", () => ({
  sendToOperator: vi.fn()
}))

vi.mock("@/integrations/resend.ts", () => ({
  sendEmailToOperator: vi.fn()
}))

vi.mock("@/memory/episodic.ts", () => ({
  storeEpisode: vi.fn().mockResolvedValue("ep-1"),
  queryRelated: vi.fn().mockResolvedValue([])
}))

vi.mock("@/memory/goals.ts", () => ({
  getActiveGoals: vi.fn().mockResolvedValue([]),
  createGoal: vi.fn()
}))

vi.mock("@/emotion/state.ts", () => ({
  getEmotionalState: vi.fn(),
  getEmotionHistory: vi.fn().mockResolvedValue([])
}))

vi.mock("@/memory/working.ts", () => ({
  getAllConversationMessages: vi.fn().mockResolvedValue([]),
  getPerceptionSummary: vi.fn().mockResolvedValue(null),
  getRecentTriageDecisions: vi.fn().mockResolvedValue([])
}))

vi.mock("@/memory/semantic.ts", () => ({
  getKnowledge: vi.fn(),
  getOperatorLanguage: vi.fn(() => "German")
}))

vi.mock("@/perception/evaluate.ts", () => ({
  evaluatePerception: vi.fn()
}))

vi.mock("@/personality/dna.ts", () => ({
  getEffectivePersonality: vi.fn().mockResolvedValue(null)
}))

vi.mock("@/personality/expression.ts", () => ({
  buildPersonalityPrompt: vi.fn().mockReturnValue("")
}))

vi.mock("@/trust/history.ts", () => ({
  recordSuccess: vi.fn(),
  recordFailure: vi.fn()
}))

vi.mock("@/config/result-helpers.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config/result-helpers.ts")>()
  return {
    ...actual,
    logAndCaptureError: vi.fn()
  }
})

vi.mock("@/prompts/workflow.ts", () => ({
  WORKFLOW_EXECUTION_SYSTEM_PROMPT: "Execute workflow",
  PERCEPTION_TRIGGER_EVAL_PROMPT: "Condition: {condition}\n{perceptionData}"
}))

vi.mock("@/lib/time.ts", () => ({
  TIMEZONE: "UTC",
  nowLocal: vi.fn(() => new Date())
}))

import { err, ok } from "neverthrow"
import type { WorkflowDefinition } from "@/core/types.ts"
import { db } from "@/db/client.ts"
import { getEmotionalState, getEmotionHistory } from "@/emotion/state.ts"
import { callClaude } from "@/integrations/anthropic.ts"
import { sendToOperator } from "@/integrations/telegram.ts"
import { storeEpisode } from "@/memory/episodic.ts"
import { createGoal } from "@/memory/goals.ts"
import { makeEmotionalState, makePerceptionSummary } from "@/test/factories.ts"
import type { MockDbChain } from "@/test/mocks.ts"
import { recordFailure, recordSuccess } from "@/trust/history.ts"
import {
  checkWorkflowTriggers,
  executeWorkflow,
  gatherWorkflowData,
  getActiveWorkflows,
  getRecentTickSummaries
} from "./workflow-engine.ts"

const mockDb = db as unknown as MockDbChain
const mockCallClaude = callClaude as ReturnType<typeof vi.fn>
const mockSendToOperator = sendToOperator as ReturnType<typeof vi.fn>
const mockStoreEpisode = storeEpisode as ReturnType<typeof vi.fn>
const mockCreateGoal = createGoal as ReturnType<typeof vi.fn>
const mockGetEmotionalState = getEmotionalState as ReturnType<typeof vi.fn>
const mockGetEmotionHistory = getEmotionHistory as ReturnType<typeof vi.fn>
const mockRecordSuccess = recordSuccess as ReturnType<typeof vi.fn>
const mockRecordFailure = recordFailure as ReturnType<typeof vi.fn>

function makeWorkflow(overrides?: Partial<WorkflowDefinition>): WorkflowDefinition {
  return {
    id: "wf-1",
    name: "Morning Digest",
    description: "Summarizes overnight activity",
    trigger: { type: "schedule", hour: 8 },
    instruction: "Summarize the recent activity and goals",
    model: "sonnet",
    dataSources: ["goals", "tick_history"],
    outputAction: "telegram_send",
    enabled: true,
    createdBy: "dream",
    executionCount: 0,
    lastExecutedAt: null,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  }
}

describe("getActiveWorkflows", () => {
  it("returns empty array when no workflows exist", async () => {
    mockDb.where.mockResolvedValue([])
    const result = await getActiveWorkflows()
    expect(result).toEqual([])
  })

  it("maps DB rows to WorkflowDefinition shape", async () => {
    mockDb.where.mockResolvedValue([
      {
        id: "wf-1",
        name: "Test",
        description: null,
        trigger: { type: "schedule", hour: 9 },
        instruction: "Do something",
        model: "sonnet",
        dataSources: ["goals"],
        outputAction: "log_only",
        enabled: true,
        createdBy: "dream",
        executionCount: 0,
        lastExecutedAt: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ])

    const result = await getActiveWorkflows()
    expect(result).toHaveLength(1)
    expect(result[0]?.name).toBe("Test")
    expect(result[0]?.trigger).toEqual({ type: "schedule", hour: 9 })
  })
})

describe("getRecentTickSummaries", () => {
  it("returns empty array when no ticks exist", async () => {
    mockDb.limit.mockResolvedValue([])
    const result = await getRecentTickSummaries()
    expect(result).toEqual([])
  })
})

describe("checkWorkflowTriggers", () => {
  it("returns empty array for no workflows", async () => {
    const result = await checkWorkflowTriggers([], makeEmotionalState(), null, [])
    expect(result).toEqual([])
  })

  it("triggers schedule workflow when hour matches", async () => {
    const currentHour = new Date().getHours()
    const workflow = makeWorkflow({
      trigger: { type: "schedule", hour: currentHour }
    })

    const result = await checkWorkflowTriggers([workflow], makeEmotionalState(), null, [])
    expect(result).toHaveLength(1)
    expect(result[0]?.name).toBe("Morning Digest")
  })

  it("does not trigger schedule workflow when hour does not match", async () => {
    const wrongHour = (new Date().getHours() + 12) % 24
    const workflow = makeWorkflow({
      trigger: { type: "schedule", hour: wrongHour }
    })

    const result = await checkWorkflowTriggers([workflow], makeEmotionalState(), null, [])
    expect(result).toHaveLength(0)
  })

  it("skips workflow executed less than 1 hour ago", async () => {
    const currentHour = new Date().getHours()
    const workflow = makeWorkflow({
      trigger: { type: "schedule", hour: currentHour },
      lastExecutedAt: new Date().toISOString()
    })

    const result = await checkWorkflowTriggers([workflow], makeEmotionalState(), null, [])
    expect(result).toHaveLength(0)
  })

  it("triggers emotion workflow when threshold exceeded", async () => {
    const workflow = makeWorkflow({
      trigger: {
        type: "emotion",
        dimension: "frustration",
        operator: "gt",
        threshold: 0.7
      }
    })

    const result = await checkWorkflowTriggers([workflow], makeEmotionalState({ frustration: 0.9 }), null, [])
    expect(result).toHaveLength(1)
  })

  it("does not trigger emotion workflow when below threshold", async () => {
    const workflow = makeWorkflow({
      trigger: {
        type: "emotion",
        dimension: "frustration",
        operator: "gt",
        threshold: 0.7
      }
    })

    const result = await checkWorkflowTriggers([workflow], makeEmotionalState({ frustration: 0.3 }), null, [])
    expect(result).toHaveLength(0)
  })

  it("triggers emotion 'lt' workflow correctly", async () => {
    const workflow = makeWorkflow({
      trigger: {
        type: "emotion",
        dimension: "curiosity",
        operator: "lt",
        threshold: 0.3
      }
    })

    const result = await checkWorkflowTriggers([workflow], makeEmotionalState({ curiosity: 0.1 }), null, [])
    expect(result).toHaveLength(1)
  })

  it("triggers emotion workflow with sustainedTicks when history meets threshold", async () => {
    const workflow = makeWorkflow({
      trigger: {
        type: "emotion",
        dimension: "frustration",
        operator: "gt",
        threshold: 0.7,
        sustainedTicks: 3
      }
    })

    mockGetEmotionHistory.mockResolvedValue([
      { state: makeEmotionalState({ frustration: 0.9 }) },
      { state: makeEmotionalState({ frustration: 0.8 }) },
      { state: makeEmotionalState({ frustration: 0.75 }) }
    ])

    const result = await checkWorkflowTriggers([workflow], makeEmotionalState({ frustration: 0.9 }), null, [])
    expect(result).toHaveLength(1)
  })

  it("does not trigger emotion workflow with sustainedTicks when history dips below threshold", async () => {
    const workflow = makeWorkflow({
      trigger: {
        type: "emotion",
        dimension: "frustration",
        operator: "gt",
        threshold: 0.7,
        sustainedTicks: 3
      }
    })

    mockGetEmotionHistory.mockResolvedValue([
      { state: makeEmotionalState({ frustration: 0.9 }) },
      { state: makeEmotionalState({ frustration: 0.5 }) },
      { state: makeEmotionalState({ frustration: 0.8 }) }
    ])

    const result = await checkWorkflowTriggers([workflow], makeEmotionalState({ frustration: 0.9 }), null, [])
    expect(result).toHaveLength(0)
  })

  it("does not trigger emotion workflow with sustainedTicks when not enough history", async () => {
    const workflow = makeWorkflow({
      trigger: {
        type: "emotion",
        dimension: "frustration",
        operator: "gt",
        threshold: 0.7,
        sustainedTicks: 5
      }
    })

    mockGetEmotionHistory.mockResolvedValue([
      { state: makeEmotionalState({ frustration: 0.9 }) },
      { state: makeEmotionalState({ frustration: 0.8 }) }
    ])

    const result = await checkWorkflowTriggers([workflow], makeEmotionalState({ frustration: 0.9 }), null, [])
    expect(result).toHaveLength(0)
  })

  it("triggers idle_streak when consecutive idle decisions match", async () => {
    const workflow = makeWorkflow({
      trigger: { type: "idle_streak", consecutiveTicks: 3 }
    })

    const result = await checkWorkflowTriggers([workflow], makeEmotionalState(), null, [
      "idle",
      "idle",
      "idle",
      "simple"
    ])
    expect(result).toHaveLength(1)
  })

  it("does not trigger idle_streak when not enough consecutive idle", async () => {
    const workflow = makeWorkflow({
      trigger: { type: "idle_streak", consecutiveTicks: 3 }
    })

    const result = await checkWorkflowTriggers([workflow], makeEmotionalState(), null, ["idle", "simple", "idle"])
    expect(result).toHaveLength(0)
  })

  it("triggers perception workflow via LLM evaluation", async () => {
    mockCallClaude.mockResolvedValue(ok("true"))
    const workflow = makeWorkflow({
      trigger: { type: "perception", condition: "operator has been active" }
    })

    const result = await checkWorkflowTriggers([workflow], makeEmotionalState(), makePerceptionSummary(), [])
    expect(result).toHaveLength(1)
    expect(mockCallClaude).toHaveBeenCalled()
  })

  it("does not trigger perception workflow when LLM returns false", async () => {
    mockCallClaude.mockResolvedValue(ok("false"))
    const workflow = makeWorkflow({
      trigger: { type: "perception", condition: "operator offline for 24h" }
    })

    const result = await checkWorkflowTriggers([workflow], makeEmotionalState(), makePerceptionSummary(), [])
    expect(result).toHaveLength(0)
  })

  it("does not trigger perception workflow when no perception data", async () => {
    const workflow = makeWorkflow({
      trigger: { type: "perception", condition: "something" }
    })

    const result = await checkWorkflowTriggers([workflow], makeEmotionalState(), null, [])
    expect(result).toHaveLength(0)
  })
})

describe("gatherWorkflowData", () => {
  it("returns empty string for empty data sources", async () => {
    const data = await gatherWorkflowData([])
    expect(data).toBe("")
  })

  it("gathers emotion data", async () => {
    mockGetEmotionalState.mockResolvedValue(makeEmotionalState({ curiosity: 0.8 }))
    const data = await gatherWorkflowData(["emotion"])
    expect(data).toContain("Emotional State")
    expect(data).toContain("curiosity")
  })
})

describe("executeWorkflow", () => {
  beforeEach(() => {
    mockGetEmotionalState.mockResolvedValue(makeEmotionalState())
    mockCallClaude.mockResolvedValue(ok("Hello operator!"))
    mockSendToOperator.mockResolvedValue(undefined)
    mockStoreEpisode.mockResolvedValue("ep-1")
    mockCreateGoal.mockResolvedValue(ok("goal-1"))
    mockRecordSuccess.mockResolvedValue(ok(undefined))
    mockRecordFailure.mockResolvedValue(ok(undefined))
    mockDb.where.mockResolvedValue([])
  })

  it("executes telegram_send workflow successfully", async () => {
    const workflow = makeWorkflow({ outputAction: "telegram_send" })

    const result = await executeWorkflow(workflow)

    expect(result.success).toBe(true)
    expect(result.workflowName).toBe("Morning Digest")
    expect(mockCallClaude).toHaveBeenCalled()
    expect(mockSendToOperator).toHaveBeenCalledWith("Hello operator!")
    expect(mockRecordSuccess).toHaveBeenCalledWith("workflow_creation")
  })

  it("executes store_episode workflow successfully", async () => {
    mockCallClaude.mockResolvedValue(ok("Summary of activity"))
    const workflow = makeWorkflow({ outputAction: "store_episode" })

    const result = await executeWorkflow(workflow)

    expect(result.success).toBe(true)
    expect(mockStoreEpisode).toHaveBeenCalled()
  })

  it("executes create_goal workflow successfully", async () => {
    mockCallClaude.mockResolvedValue(
      ok(
        JSON.stringify({
          title: "New Goal",
          description: "A goal from workflow",
          priority: 0.7
        })
      )
    )
    const workflow = makeWorkflow({ outputAction: "create_goal" })

    const result = await executeWorkflow(workflow)

    expect(result.success).toBe(true)
    expect(mockCreateGoal).toHaveBeenCalledWith("New Goal", "A goal from workflow", "self", 0.7)
  })

  it("executes log_only workflow without side effects", async () => {
    mockCallClaude.mockResolvedValue(ok("Analysis result"))
    const workflow = makeWorkflow({ outputAction: "log_only" })

    const result = await executeWorkflow(workflow)

    expect(result.success).toBe(true)
    expect(mockSendToOperator).not.toHaveBeenCalled()
    expect(mockCreateGoal).not.toHaveBeenCalled()
  })

  it("returns failure on LLM error", async () => {
    mockCallClaude.mockResolvedValue(
      err({ tag: "ANTHROPIC_ERROR", message: "API timeout", cause: new Error("API timeout") })
    )
    const workflow = makeWorkflow()

    const result = await executeWorkflow(workflow)

    expect(result.success).toBe(false)
    expect(result.error).toContain("API timeout")
    expect(mockRecordFailure).toHaveBeenCalledWith("workflow_creation")
  })
})
