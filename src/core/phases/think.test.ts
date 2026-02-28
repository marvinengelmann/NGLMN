import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/logger.ts", () => ({
  log: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() }
}))

vi.mock("@/lib/sentry.ts", () => ({
  captureError: vi.fn(),
  setTickContext: vi.fn(),
  addBreadcrumb: vi.fn()
}))

vi.mock("@/core/intelligence.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/core/intelligence.ts")>()),
  callIntelligence: vi.fn()
}))

vi.mock("@/memory/working.ts", () => ({
  getRecentTriageDecisions: vi.fn(),
  pushRecentTriageDecision: vi.fn()
}))

vi.mock("@/core/context.ts", () => ({
  buildTriageContext: vi.fn()
}))

vi.mock("@/prompts/triage.ts", () => ({
  TRIAGE_SYSTEM_PROMPT: "mock triage prompt"
}))

vi.mock("@/evolution/prompt.ts", () => ({
  loadPrompt: vi.fn((_key: string, fallback: string) => fallback)
}))

vi.mock("@/core/consciousness.ts", () => ({
  buildConsciousnessPrompt: vi.fn(() => Promise.resolve("[IDENTITY]\nTest identity\n\npersonality prompt"))
}))

vi.mock("@/core/workflow.ts", () => ({
  getActiveWorkflows: vi.fn(() => []),
  checkWorkflowTriggers: vi.fn(() => []),
  executeWorkflow: vi.fn()
}))

import { ok } from "neverthrow"
import { buildTriageContext } from "@/core/context.ts"
import { callIntelligence } from "@/core/intelligence.ts"
import { checkWorkflowTriggers, executeWorkflow, getActiveWorkflows } from "@/core/workflow.ts"
import { addBreadcrumb, captureError, setTickContext } from "@/lib/sentry.ts"
import { getRecentTriageDecisions, pushRecentTriageDecision } from "@/memory/working.ts"
import { makeEmotionalState, makePerceptionSummary, makeWorkflowDefinition } from "@/test/factories.ts"
import type { SenseResult, TickContext } from "./sense.ts"
import { think } from "./think.ts"

const mockCallIntelligence = callIntelligence as ReturnType<typeof vi.fn>
const mockCaptureError = captureError as ReturnType<typeof vi.fn>
const mockAddBreadcrumb = addBreadcrumb as ReturnType<typeof vi.fn>
const mockSetTickContext = setTickContext as ReturnType<typeof vi.fn>
const mockGetRecentTriageDecisions = getRecentTriageDecisions as ReturnType<typeof vi.fn>
const mockPushRecentTriageDecision = pushRecentTriageDecision as ReturnType<typeof vi.fn>
const mockBuildTriageContext = buildTriageContext as ReturnType<typeof vi.fn>
const mockGetActiveWorkflows = getActiveWorkflows as ReturnType<typeof vi.fn>
const mockCheckWorkflowTriggers = checkWorkflowTriggers as ReturnType<typeof vi.fn>
const mockExecuteWorkflow = executeWorkflow as ReturnType<typeof vi.fn>

const ctx: TickContext = {
  tickId: "tick-test",
  startTime: Date.now(),
  timestamp: new Date().toISOString()
}

const senseResult: SenseResult = {
  perception: makePerceptionSummary(),
  emotion: makeEmotionalState()
}

describe("think phase", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetRecentTriageDecisions.mockResolvedValue([])
    mockBuildTriageContext.mockResolvedValue({ userPrompt: "triage context" })
  })

  it("parses valid triage JSON into TriageResult", async () => {
    mockCallIntelligence.mockResolvedValue(
      ok({
        decision: "simple",
        reason: "operator might enjoy update",
        confidence: 0.8,
        estimatedTokens: 200
      })
    )

    const result = await think(ctx, senseResult)

    expect(result.triageResult.decision).toBe("simple")
    expect(result.triageResult.reason).toBe("operator might enjoy update")
    expect(result.triageResult.confidence).toBe(0.8)
  })

  it("returns triggered workflows without executing them", async () => {
    const workflow = makeWorkflowDefinition()
    mockGetActiveWorkflows.mockResolvedValue([workflow])
    mockCheckWorkflowTriggers.mockResolvedValue([workflow])
    mockCallIntelligence.mockResolvedValue(
      ok({
        decision: "idle",
        reason: "test",
        confidence: 0.5,
        estimatedTokens: 0
      })
    )

    const result = await think(ctx, senseResult)

    expect(result.triggeredWorkflows).toEqual([workflow])
    expect(mockExecuteWorkflow).not.toHaveBeenCalled()
  })

  it("catches workflow errors without blocking triage", async () => {
    mockGetActiveWorkflows.mockRejectedValue(new Error("workflow db down"))
    mockCallIntelligence.mockResolvedValue(
      ok({
        decision: "idle",
        reason: "test",
        confidence: 0.5,
        estimatedTokens: 0
      })
    )

    const result = await think(ctx, senseResult)

    expect(mockCaptureError).toHaveBeenCalledWith(expect.any(Error), { tag: "WORKFLOW_ERROR", phase: "workflows" })
    expect(result.triageResult.decision).toBe("idle")
  })

  it("sets Sentry breadcrumbs for triage", async () => {
    mockCallIntelligence.mockResolvedValue(
      ok({
        decision: "complex",
        reason: "interesting pattern",
        confidence: 0.9,
        estimatedTokens: 500
      })
    )

    await think(ctx, senseResult)

    expect(mockAddBreadcrumb).toHaveBeenCalledWith(
      "triage",
      "Decision: complex",
      expect.objectContaining({ decision: "complex", reason: "interesting pattern" })
    )
  })

  it("pushes triage decision to recent decisions", async () => {
    mockCallIntelligence.mockResolvedValue(
      ok({
        decision: "deep",
        reason: "deep thought",
        confidence: 0.95,
        estimatedTokens: 1000
      })
    )

    await think(ctx, senseResult)

    expect(mockPushRecentTriageDecision).toHaveBeenCalledWith("deep")
  })

  it("builds consciousness prompt correctly", async () => {
    mockCallIntelligence.mockResolvedValue(
      ok({
        decision: "idle",
        reason: "test",
        confidence: 0.5,
        estimatedTokens: 0
      })
    )

    const result = await think(ctx, senseResult)

    expect(result.consciousnessPrompt).toContain("[IDENTITY]")
    expect(result.consciousnessPrompt).toContain("personality prompt")
  })

  it("updates tick context with decision", async () => {
    mockCallIntelligence.mockResolvedValue(
      ok({
        decision: "simple",
        reason: "test",
        confidence: 0.8,
        estimatedTokens: 100
      })
    )

    await think(ctx, senseResult)

    expect(mockSetTickContext).toHaveBeenCalledWith({
      tickId: "tick-test",
      decision: "simple",
      tier: "simple"
    })
  })
})
