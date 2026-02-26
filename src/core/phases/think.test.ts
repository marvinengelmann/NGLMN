import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/logger.ts", () => ({
  log: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() }
}))

vi.mock("@/lib/sentry.ts", () => ({
  captureError: vi.fn(),
  setTickContext: vi.fn(),
  addBreadcrumb: vi.fn()
}))

vi.mock("@/integrations/anthropic.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/integrations/anthropic.ts")>()),
  callClaude: vi.fn()
}))

vi.mock("@/memory/working.ts", () => ({
  getRecentTriageDecisions: vi.fn(),
  pushRecentTriageDecision: vi.fn()
}))

vi.mock("@/core/context-builder.ts", () => ({
  buildTriageContext: vi.fn()
}))

vi.mock("@/core/model-router.ts", () => ({
  getModelForPhase: vi.fn(() => "claude-haiku-4-5-20251001"),
  getMaxTokensForTier: vi.fn(() => 500)
}))

vi.mock("@/prompts/triage.ts", () => ({
  TRIAGE_SYSTEM_PROMPT: "mock triage prompt"
}))

vi.mock("@/evolution/prompt-loader.ts", () => ({
  loadPrompt: vi.fn((_key: string, fallback: string) => fallback)
}))

vi.mock("@/personality/dna.ts", () => ({
  getEffectivePersonality: vi.fn()
}))

vi.mock("@/personality/expression.ts", () => ({
  buildPersonalityPrompt: vi.fn(() => "personality prompt")
}))

vi.mock("@/personality/mbti.ts", () => ({
  getMbtiType: vi.fn(() => undefined)
}))

vi.mock("@/core/workflow-engine.ts", () => ({
  getActiveWorkflows: vi.fn(() => []),
  checkWorkflowTriggers: vi.fn(() => []),
  executeWorkflow: vi.fn()
}))

import { ok } from "neverthrow"
import { buildTriageContext } from "@/core/context-builder.ts"
import { checkWorkflowTriggers, executeWorkflow, getActiveWorkflows } from "@/core/workflow-engine.ts"
import { callClaude } from "@/integrations/anthropic.ts"
import { addBreadcrumb, captureError, setTickContext } from "@/lib/sentry.ts"
import { getRecentTriageDecisions, pushRecentTriageDecision } from "@/memory/working.ts"
import { getEffectivePersonality } from "@/personality/dna.ts"
import { buildPersonalityPrompt } from "@/personality/expression.ts"
import {
  makeEmotionalState,
  makePerceptionSummary,
  makePersonalityLayer,
  makeWorkflowDefinition
} from "@/test/factories.ts"
import type { SenseResult, TickContext } from "./sense.ts"
import { think } from "./think.ts"

const mockCallClaude = callClaude as ReturnType<typeof vi.fn>
const mockCaptureError = captureError as ReturnType<typeof vi.fn>
const mockAddBreadcrumb = addBreadcrumb as ReturnType<typeof vi.fn>
const mockSetTickContext = setTickContext as ReturnType<typeof vi.fn>
const mockGetRecentTriageDecisions = getRecentTriageDecisions as ReturnType<typeof vi.fn>
const mockPushRecentTriageDecision = pushRecentTriageDecision as ReturnType<typeof vi.fn>
const mockBuildTriageContext = buildTriageContext as ReturnType<typeof vi.fn>
const mockGetEffectivePersonality = getEffectivePersonality as ReturnType<typeof vi.fn>
const mockBuildPersonalityPrompt = buildPersonalityPrompt as ReturnType<typeof vi.fn>
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
    mockGetEffectivePersonality.mockResolvedValue(makePersonalityLayer())
    mockBuildPersonalityPrompt.mockReturnValue("personality prompt")
  })

  it("parses valid triage JSON into TriageResult", async () => {
    const triageJson = JSON.stringify({
      decision: "simple",
      reason: "operator might enjoy update",
      confidence: 0.8,
      estimatedTokens: 200
    })
    mockCallClaude.mockResolvedValue(ok(triageJson))

    const result = await think(ctx, senseResult)

    expect(result.triageResult.decision).toBe("simple")
    expect(result.triageResult.reason).toBe("operator might enjoy update")
    expect(result.triageResult.confidence).toBe(0.8)
  })

  it("falls back to idle on triage parse error", async () => {
    mockCallClaude.mockResolvedValue(ok("not valid json at all"))

    const result = await think(ctx, senseResult)

    expect(result.triageResult.decision).toBe("idle")
    expect(result.triageResult.reason).toBe("triage parse error")
    expect(mockCaptureError).toHaveBeenCalled()
  })

  it("returns triggered workflows without executing them", async () => {
    const workflow = makeWorkflowDefinition()
    mockGetActiveWorkflows.mockResolvedValue([workflow])
    mockCheckWorkflowTriggers.mockResolvedValue([workflow])
    mockCallClaude.mockResolvedValue(
      ok(
        JSON.stringify({
          decision: "idle",
          reason: "test",
          confidence: 0.5,
          estimatedTokens: 0
        })
      )
    )

    const result = await think(ctx, senseResult)

    expect(result.triggeredWorkflows).toEqual([workflow])
    expect(mockExecuteWorkflow).not.toHaveBeenCalled()
  })

  it("catches workflow errors without blocking triage", async () => {
    mockGetActiveWorkflows.mockRejectedValue(new Error("workflow db down"))
    mockCallClaude.mockResolvedValue(
      ok(
        JSON.stringify({
          decision: "idle",
          reason: "test",
          confidence: 0.5,
          estimatedTokens: 0
        })
      )
    )

    const result = await think(ctx, senseResult)

    expect(mockCaptureError).toHaveBeenCalledWith(expect.any(Error), { tag: "WORKFLOW_ERROR", phase: "workflows" })
    expect(result.triageResult.decision).toBe("idle")
  })

  it("sets Sentry breadcrumbs for triage", async () => {
    mockCallClaude.mockResolvedValue(
      ok(
        JSON.stringify({
          decision: "complex",
          reason: "interesting pattern",
          confidence: 0.9,
          estimatedTokens: 500
        })
      )
    )

    await think(ctx, senseResult)

    expect(mockAddBreadcrumb).toHaveBeenCalledWith(
      "triage",
      "Decision: complex",
      expect.objectContaining({ decision: "complex", reason: "interesting pattern" })
    )
  })

  it("pushes triage decision to recent decisions", async () => {
    mockCallClaude.mockResolvedValue(
      ok(
        JSON.stringify({
          decision: "deep",
          reason: "deep thought",
          confidence: 0.95,
          estimatedTokens: 1000
        })
      )
    )

    await think(ctx, senseResult)

    expect(mockPushRecentTriageDecision).toHaveBeenCalledWith("deep")
  })

  it("builds personality prompt correctly", async () => {
    const personality = makePersonalityLayer({ warmth: 0.9 })
    mockGetEffectivePersonality.mockResolvedValue(personality)
    mockCallClaude.mockResolvedValue(
      ok(
        JSON.stringify({
          decision: "idle",
          reason: "test",
          confidence: 0.5,
          estimatedTokens: 0
        })
      )
    )

    const result = await think(ctx, senseResult)

    expect(mockBuildPersonalityPrompt).toHaveBeenCalledWith(personality, senseResult.emotion, undefined)
    expect(result.personalityPrompt).toBe("personality prompt")
  })

  it("updates tick context with decision", async () => {
    mockCallClaude.mockResolvedValue(
      ok(
        JSON.stringify({
          decision: "simple",
          reason: "test",
          confidence: 0.8,
          estimatedTokens: 100
        })
      )
    )

    await think(ctx, senseResult)

    expect(mockSetTickContext).toHaveBeenCalledWith({
      tickId: "tick-test",
      decision: "simple",
      tier: "simple"
    })
  })
})
