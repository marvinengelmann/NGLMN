vi.mock("@/lib/result.ts", () => ({
  logAndCaptureError: vi.fn()
}))

vi.mock("@/core/workflow.ts", () => ({
  getRecentTickSummaries: vi.fn()
}))

vi.mock("@/emotion/metrics.ts", () => ({
  collectMetrics: vi.fn()
}))

vi.mock("@/evolution/code.ts", () => ({
  proposeCodeChange: vi.fn(),
  executeCodeEvolution: vi.fn()
}))

vi.mock("@/evolution/prompt.ts", () => ({
  proposePromptChange: vi.fn(),
  applyPromptChange: vi.fn(),
  loadPrompt: vi.fn()
}))

vi.mock("@/evolution/workflow.ts", () => ({
  proposeWorkflow: vi.fn(),
  applyWorkflow: vi.fn()
}))

vi.mock("@/lib/logger.ts", () => ({
  log: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() }
}))

vi.mock("@/lib/sentry.ts", () => ({
  captureError: vi.fn()
}))

vi.mock("@/memory/working.ts", () => ({
  getRecentResponses: vi.fn().mockResolvedValue([]),
  setTaskActive: vi.fn()
}))

vi.mock("@/prompts/responder.ts", () => ({
  RESPONDER_SYSTEM_PROMPT: "fallback responder"
}))

vi.mock("@/prompts/triage.ts", () => ({
  TRIAGE_SYSTEM_PROMPT: "fallback triage"
}))

import { err, ok } from "neverthrow"
import { collectMetrics } from "@/emotion/metrics.ts"
import { executeCodeEvolution, proposeCodeChange } from "@/evolution/code.ts"
import { applyPromptChange, loadPrompt, proposePromptChange } from "@/evolution/prompt.ts"
import { applyWorkflow, proposeWorkflow } from "@/evolution/workflow.ts"
import { logAndCaptureError } from "@/lib/result.ts"
import { makeMetricsSnapshot } from "@/test/factories.ts"
import type { EvolutionPayload } from "./orchestrator.ts"
import { runEvolution } from "./orchestrator.ts"

const mockLoadPrompt = loadPrompt as ReturnType<typeof vi.fn>
const mockCollectMetrics = collectMetrics as ReturnType<typeof vi.fn>
const mockProposePrompt = proposePromptChange as ReturnType<typeof vi.fn>
const mockApplyPrompt = applyPromptChange as ReturnType<typeof vi.fn>
const mockProposeCode = proposeCodeChange as ReturnType<typeof vi.fn>
const mockExecuteCode = executeCodeEvolution as ReturnType<typeof vi.fn>
const mockProposeWorkflow = proposeWorkflow as ReturnType<typeof vi.fn>
const mockApplyWorkflow = applyWorkflow as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  mockCollectMetrics.mockResolvedValue(makeMetricsSnapshot())
})

describe("runEvolution — prompt branch", () => {
  it("skips when proposal says no change needed", async () => {
    mockLoadPrompt.mockResolvedValue("current")
    mockProposePrompt.mockResolvedValue({ shouldChange: false, reasoning: "looks good" })

    const result = await runEvolution({ type: "prompt", promptId: "triage" })

    expect(result.action).toBe("skipped")
  })

  it("returns pending_approval when not autonomous", async () => {
    mockLoadPrompt.mockResolvedValue("current")
    mockProposePrompt.mockResolvedValue({ shouldChange: true, autonomous: false, changelog: "big change" })

    const result = await runEvolution({ type: "prompt", promptId: "triage" })

    expect(result.action).toBe("pending_approval")
  })

  it("skips when autonomous but no new prompt content", async () => {
    mockLoadPrompt.mockResolvedValue("current")
    mockProposePrompt.mockResolvedValue({ shouldChange: true, autonomous: true, newPrompt: null })

    const result = await runEvolution({ type: "prompt", promptId: "triage" })

    expect(result.action).toBe("skipped")
  })

  it("applies prompt change when autonomous with content", async () => {
    mockLoadPrompt.mockResolvedValue("current")
    mockProposePrompt.mockResolvedValue({
      shouldChange: true,
      autonomous: true,
      newPrompt: "new prompt",
      changelog: "improved"
    })
    mockApplyPrompt.mockResolvedValue(2)

    const result = await runEvolution({ type: "prompt", promptId: "triage" })

    expect(result.action).toBe("applied")
    expect(result.version).toBe(2)
    expect(mockApplyPrompt).toHaveBeenCalledWith("triage", "new prompt", "improved")
  })
})

describe("runEvolution — code branch", () => {
  const codePayload: EvolutionPayload = { type: "code", insight: "better caching", capabilityGap: "no cache layer" }

  it("skips when proposal says no change needed", async () => {
    mockProposeCode.mockResolvedValue({ shouldEvolve: false, reasoning: "not worth it" })

    const result = await runEvolution(codePayload)

    expect(result.action).toBe("skipped")
  })

  it("returns pending_approval when not autonomous", async () => {
    mockProposeCode.mockResolvedValue({ shouldEvolve: true, autonomous: false })

    const result = await runEvolution(codePayload)

    expect(result.action).toBe("pending_approval")
  })

  it("executes and returns applied on success", async () => {
    mockProposeCode.mockResolvedValue({ shouldEvolve: true, autonomous: true })
    mockExecuteCode.mockResolvedValue({ success: true })

    const result = await runEvolution(codePayload)

    expect(result.action).toBe("applied")
  })

  it("captures error and returns failed on execution failure", async () => {
    mockProposeCode.mockResolvedValue({ shouldEvolve: true, autonomous: true })
    mockExecuteCode.mockResolvedValue({ success: false, error: "tests failed" })

    const result = await runEvolution(codePayload)

    expect(result.action).toBe("failed")
  })
})

describe("runEvolution — workflow branch", () => {
  const wfPayload: EvolutionPayload = { type: "workflow", insight: "automate morning check" }

  it("skips when proposal says no creation needed", async () => {
    mockProposeWorkflow.mockResolvedValue({ shouldCreate: false, reasoning: "exists already" })

    const result = await runEvolution(wfPayload)

    expect(result.action).toBe("skipped")
  })

  it("returns pending_approval when not autonomous", async () => {
    mockProposeWorkflow.mockResolvedValue({ shouldCreate: true, autonomous: false, name: "Morning Check" })

    const result = await runEvolution(wfPayload)

    expect(result.action).toBe("pending_approval")
  })

  it("applies workflow and returns ID on success", async () => {
    mockProposeWorkflow.mockResolvedValue({ shouldCreate: true, autonomous: true, name: "Morning Check" })
    mockApplyWorkflow.mockResolvedValue(ok("wf-123"))

    const result = await runEvolution(wfPayload)

    expect(result.action).toBe("applied")
    expect(result.workflowId).toBe("wf-123")
  })

  it("logs error and returns failed when applyWorkflow fails", async () => {
    mockProposeWorkflow.mockResolvedValue({ shouldCreate: true, autonomous: true, name: "Morning Check" })
    mockApplyWorkflow.mockResolvedValue(err({ tag: "WORKFLOW_ERROR", message: "insert failed" }))

    const result = await runEvolution(wfPayload)

    expect(result.action).toBe("failed")
    expect(logAndCaptureError).toHaveBeenCalled()
  })
})

describe("runEvolution — invalid payload", () => {
  it("returns invalid for missing required fields", async () => {
    const result = await runEvolution({ type: "prompt" })

    expect(result.action).toBe("invalid")
  })

  it("returns invalid for unknown type", async () => {
    const result = await runEvolution({ type: "unknown" as EvolutionPayload["type"] })

    expect(result.action).toBe("invalid")
  })
})
