vi.mock("@/db/client.ts", () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.insert = vi.fn().mockReturnValue(chain)
  chain.values = vi.fn().mockResolvedValue([])
  chain.returning = vi.fn().mockResolvedValue([{ id: "pv-1" }])
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

vi.mock("./changelog.ts", () => ({
  writeChangelogEntry: vi.fn()
}))

import { ok } from "neverthrow"
import { callIntelligence } from "@/core/intelligence.ts"
import { db } from "@/db/client.ts"
import { makeMetricsSnapshot, makeTrustAssessment } from "@/test/factories.ts"
import type { MockDbChain } from "@/test/mocks.ts"
import { canActAutonomously } from "@/trust/assessment.ts"
import { recordSuccess } from "@/trust/history.ts"
import { writeChangelogEntry } from "./changelog.ts"
import {
  applyPromptChange,
  getCurrentPromptVersion,
  getPromptHistory,
  loadPrompt,
  proposePromptChange,
  rollbackPrompt
} from "./prompt.ts"

const mockDb = db as unknown as MockDbChain
const mockCallIntelligence = callIntelligence as ReturnType<typeof vi.fn>
const mockCanActAutonomously = canActAutonomously as ReturnType<typeof vi.fn>
const mockRecordSuccess = recordSuccess as ReturnType<typeof vi.fn>
const mockWriteChangelogEntry = writeChangelogEntry as ReturnType<typeof vi.fn>

describe("getCurrentPromptVersion", () => {
  it("returns version and content when found", async () => {
    mockDb.limit.mockResolvedValue([{ version: 3, content: "prompt v3" }])
    const result = await getCurrentPromptVersion("triage")
    expect(result).toEqual({ version: 3, content: "prompt v3" })
  })

  it("returns null when no versions exist", async () => {
    mockDb.limit.mockResolvedValue([])
    const result = await getCurrentPromptVersion("nonexistent")
    expect(result).toBeNull()
  })
})

describe("getPromptHistory", () => {
  it("queries with promptId and limit", async () => {
    mockDb.limit.mockResolvedValue([])
    await getPromptHistory("triage", 5)
    expect(mockDb.limit).toHaveBeenCalledWith(5)
  })
})

describe("proposePromptChange", () => {
  it("returns proposal with autonomous flag based on trust", async () => {
    mockCanActAutonomously.mockResolvedValue(makeTrustAssessment({ canAct: true }))
    mockCallIntelligence.mockResolvedValue(
      ok({
        shouldChange: true,
        newPrompt: "improved prompt",
        changelog: "Simplified instructions",
        reasoning: "Current prompt is verbose"
      })
    )

    const proposal = await proposePromptChange("triage", "current prompt", makeMetricsSnapshot(), [
      "output1",
      "output2"
    ])

    expect(proposal.shouldChange).toBe(true)
    expect(proposal.autonomous).toBe(true)
    expect(proposal.newPrompt).toBe("improved prompt")
  })

  it("marks as non-autonomous when trust is insufficient", async () => {
    mockCanActAutonomously.mockResolvedValue(makeTrustAssessment({ canAct: false }))
    mockCallIntelligence.mockResolvedValue(
      ok({
        shouldChange: false,
        newPrompt: null,
        changelog: "No change needed",
        reasoning: "Prompt performing well"
      })
    )

    const proposal = await proposePromptChange("triage", "current prompt", makeMetricsSnapshot(), [])

    expect(proposal.autonomous).toBe(false)
  })
})

describe("applyPromptChange", () => {
  beforeEach(() => {
    mockDb.limit.mockResolvedValue([])
    mockDb.values.mockResolvedValue([])
    mockWriteChangelogEntry.mockResolvedValue(ok("evo-id"))
    mockRecordSuccess.mockResolvedValue(ok(undefined))
  })

  it("inserts new version with incremented number", async () => {
    mockDb.limit.mockResolvedValueOnce([{ version: 2, content: "old" }])

    const version = await applyPromptChange("triage", "new content", "improved clarity")
    expect(version).toBe(3)
    expect(mockDb.insert).toHaveBeenCalled()
  })

  it("starts at version 1 when no prior versions", async () => {
    mockDb.limit.mockResolvedValueOnce([])

    const version = await applyPromptChange("new-prompt", "content", "initial version")
    expect(version).toBe(1)
  })
})

describe("rollbackPrompt", () => {
  it("throws when target version not found", async () => {
    mockDb.limit.mockResolvedValue([])

    await expect(rollbackPrompt("triage", 99)).rejects.toThrow("Version 99 not found")
  })
})

describe("loadPrompt", () => {
  it("returns DB content when a version exists", async () => {
    mockDb.limit.mockResolvedValue([{ content: "You are a helpful AI." }])

    const result = await loadPrompt("triage", "fallback prompt")

    expect(result).toBe("You are a helpful AI.")
  })

  it("returns fallback when DB returns empty rows", async () => {
    mockDb.limit.mockResolvedValue([])

    const result = await loadPrompt("triage", "fallback prompt")

    expect(result).toBe("fallback prompt")
  })

  it("returns fallback when DB row has null content", async () => {
    mockDb.limit.mockResolvedValue([{ content: null }])

    const result = await loadPrompt("triage", "fallback prompt")

    expect(result).toBe("fallback prompt")
  })
})
