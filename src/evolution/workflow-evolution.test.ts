vi.mock("@/db/client.ts", () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.insert = vi.fn().mockReturnValue(chain)
  chain.update = vi.fn().mockReturnValue(chain)
  chain.set = vi.fn().mockReturnValue(chain)
  chain.values = vi.fn().mockReturnValue(chain)
  chain.returning = vi.fn().mockResolvedValue([{ id: "wf-new" }])
  chain.from = vi.fn().mockReturnValue(chain)
  chain.where = vi.fn().mockReturnValue(chain)
  chain.orderBy = vi.fn().mockReturnValue(chain)
  chain.limit = vi.fn().mockResolvedValue([])
  return { db: chain }
})

vi.mock("@/core/intelligence.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/core/intelligence.ts")>()),
  callIntelligence: vi.fn()
}))

vi.mock("@/trust/assessment.ts", () => ({
  canActAutonomously: vi.fn()
}))

vi.mock("@/trust/history.ts", () => ({
  recordSuccess: vi.fn(),
  recordFailure: vi.fn()
}))

vi.mock("@/security/guardian.ts", () => ({
  validateOutput: vi.fn()
}))

vi.mock("./changelog.ts", () => ({
  writeChangelogEntry: vi.fn()
}))

vi.mock("@/prompts/workflow.ts", () => ({
  WORKFLOW_PROPOSAL_SYSTEM_PROMPT: "Propose workflow"
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
  getEmotionalState: vi.fn()
}))

vi.mock("@/memory/working.ts", () => ({
  getAllConversationMessages: vi.fn().mockResolvedValue([]),
  getPerceptionSummary: vi.fn().mockResolvedValue(null),
  getRecentTriageDecisions: vi.fn().mockResolvedValue([])
}))

vi.mock("@/memory/semantic.ts", () => ({
  getKnowledge: vi.fn()
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

vi.mock("@/core/identity.ts", () => ({
  buildIdentityPrompt: vi.fn(() => Promise.resolve("[IDENTITY]\nTest identity"))
}))

vi.mock("@/integrations/telegram.ts", () => ({
  sendToOperator: vi.fn()
}))

vi.mock("@/integrations/resend.ts", () => ({
  sendEmailToOperator: vi.fn()
}))

import { ok } from "neverthrow"
import { callIntelligence } from "@/core/intelligence.ts"
import { db } from "@/db/client.ts"
import { validateOutput } from "@/security/guardian.ts"
import { makeGuardianResult, makeTickSummary, makeTrustAssessment } from "@/test/factories.ts"
import type { MockDbChain } from "@/test/mocks.ts"
import { canActAutonomously } from "@/trust/assessment.ts"
import { recordSuccess } from "@/trust/history.ts"
import { writeChangelogEntry } from "./changelog.ts"
import { applyWorkflow, disableWorkflow, proposeWorkflow } from "./workflow-evolution.ts"

const mockDb = db as unknown as MockDbChain
const mockCallIntelligence = callIntelligence as ReturnType<typeof vi.fn>
const mockCanActAutonomously = canActAutonomously as ReturnType<typeof vi.fn>
const mockValidateOutput = validateOutput as ReturnType<typeof vi.fn>
const mockWriteChangelogEntry = writeChangelogEntry as ReturnType<typeof vi.fn>
const mockRecordSuccess = recordSuccess as ReturnType<typeof vi.fn>

describe("proposeWorkflow", () => {
  it("returns proposal with autonomous flag from trust assessment", async () => {
    mockCanActAutonomously.mockResolvedValue(makeTrustAssessment({ canAct: true }))
    mockDb.where.mockResolvedValue([])
    mockCallIntelligence.mockResolvedValue(
      ok({
        shouldCreate: true,
        reasoning: "Pattern detected: daily morning check",
        name: "Morning Check",
        description: "Check goals every morning",
        trigger: { type: "schedule", hour: 8 },
        instruction: "Review goals and summarize progress",
        model: "fast",
        dataSources: ["goals"],
        outputAction: "telegram_send"
      })
    )

    const proposal = await proposeWorkflow("I notice I check goals every morning", [makeTickSummary()])

    expect(proposal.shouldCreate).toBe(true)
    expect(proposal.autonomous).toBe(true)
    expect(proposal.name).toBe("Morning Check")
  })

  it("marks as non-autonomous when trust is insufficient", async () => {
    mockCanActAutonomously.mockResolvedValue(makeTrustAssessment({ canAct: false }))
    mockDb.where.mockResolvedValue([])
    mockCallIntelligence.mockResolvedValue(
      ok({
        shouldCreate: false,
        reasoning: "Not a clear pattern",
        name: "",
        description: "",
        trigger: { type: "schedule", hour: 0 },
        instruction: "",
        model: "fast",
        dataSources: [],
        outputAction: "log_only"
      })
    )

    const proposal = await proposeWorkflow("some pattern", [])
    expect(proposal.autonomous).toBe(false)
  })
})

describe("applyWorkflow", () => {
  beforeEach(() => {
    mockDb.where.mockResolvedValue([])
    mockDb.returning.mockResolvedValue([{ id: "wf-new" }])
    mockValidateOutput.mockResolvedValue(makeGuardianResult())
    mockWriteChangelogEntry.mockResolvedValue(ok("evo-1"))
    mockRecordSuccess.mockResolvedValue(ok(undefined))
  })

  const validProposal = {
    shouldCreate: true,
    reasoning: "Pattern detected",
    name: "Test Workflow",
    description: "A test workflow",
    trigger: { type: "schedule" as const, hour: 9 },
    instruction: "Do something useful",
    model: "reasoning",
    dataSources: ["goals" as const],
    outputAction: "log_only" as const,
    autonomous: true
  }

  it("inserts workflow and returns ID", async () => {
    const result = await applyWorkflow(validProposal)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBe("wf-new")
    expect(mockDb.insert).toHaveBeenCalled()
  })

  it("records success in changelog", async () => {
    await applyWorkflow(validProposal)
    expect(mockWriteChangelogEntry).toHaveBeenCalledWith(
      "workflow",
      expect.stringContaining("Test Workflow"),
      "success"
    )
  })

  it("returns error when max active workflows reached", async () => {
    const tenWorkflows = Array.from({ length: 10 }, (_, i) => ({ id: `wf-${i}`, enabled: true }))
    mockDb.where.mockResolvedValueOnce(tenWorkflows)

    const result = await applyWorkflow(validProposal)
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toContain("max active workflows")
  })

  it("returns error when guardian blocks instruction", async () => {
    mockValidateOutput.mockResolvedValue(
      makeGuardianResult({
        verdict: "blocked",
        reasons: ["Suspicious pattern"]
      })
    )

    const result = await applyWorkflow(validProposal)
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toContain("Guardian blocked")
  })

  it("returns error when model is invalid", async () => {
    const invalidProposal = { ...validProposal, model: "unknown" }
    const result = await applyWorkflow(invalidProposal)
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toContain("Invalid workflow model")
  })
})

describe("disableWorkflow", () => {
  it("updates enabled to false", async () => {
    mockDb.where.mockResolvedValue([])
    await disableWorkflow("wf-1")
    expect(mockDb.update).toHaveBeenCalled()
    expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }))
  })
})
