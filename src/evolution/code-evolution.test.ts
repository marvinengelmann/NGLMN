vi.mock("@/core/intelligence.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/core/intelligence.ts")>()),
  callIntelligence: vi.fn()
}))

vi.mock("@/integrations/github.ts", () => ({
  getRef: vi.fn(),
  createBranch: vi.fn(),
  createOrUpdateFile: vi.fn(),
  getFileContent: vi.fn(),
  getRepoTree: vi.fn(),
  createPullRequest: vi.fn(),
  mergePullRequest: vi.fn(),
  deleteBranch: vi.fn()
}))

vi.mock("@/integrations/e2b.ts", () => ({
  validateInSandbox: vi.fn()
}))

vi.mock("@/security/guardian.ts", () => ({
  validateEvolution: vi.fn()
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

vi.mock("@/memory/episodic.ts", () => ({
  storeEpisode: vi.fn()
}))

vi.mock("@/memory/working.ts", () => ({
  getNextEvolutionNumber: vi.fn()
}))

import { ok } from "neverthrow"
import { callIntelligence } from "@/core/intelligence.ts"
import { validateInSandbox } from "@/integrations/e2b.ts"
import {
  createBranch,
  createOrUpdateFile,
  createPullRequest,
  deleteBranch,
  getFileContent,
  getRef,
  getRepoTree,
  mergePullRequest
} from "@/integrations/github.ts"
import { storeEpisode } from "@/memory/episodic.ts"
import { getNextEvolutionNumber } from "@/memory/working.ts"
import { validateEvolution } from "@/security/guardian.ts"
import { makeSandboxResult, makeTrustAssessment } from "@/test/factories.ts"
import { canActAutonomously } from "@/trust/assessment.ts"
import { recordFailure, recordSuccess } from "@/trust/history.ts"
import { writeChangelogEntry } from "./changelog.ts"
import { executeCodeEvolution, proposeCodeChange, selectRelevantFiles } from "./code-evolution.ts"

const mockCallIntelligence = callIntelligence as ReturnType<typeof vi.fn>
const mockGetRef = getRef as ReturnType<typeof vi.fn>
const mockCreateBranch = createBranch as ReturnType<typeof vi.fn>
const mockCreateOrUpdateFile = createOrUpdateFile as ReturnType<typeof vi.fn>
const mockGetFileContent = getFileContent as ReturnType<typeof vi.fn>
const mockGetRepoTree = getRepoTree as ReturnType<typeof vi.fn>
const mockCreatePullRequest = createPullRequest as ReturnType<typeof vi.fn>
const mockMergePullRequest = mergePullRequest as ReturnType<typeof vi.fn>
const mockDeleteBranch = deleteBranch as ReturnType<typeof vi.fn>
const mockValidateInSandbox = validateInSandbox as ReturnType<typeof vi.fn>
const mockValidateEvolution = validateEvolution as ReturnType<typeof vi.fn>
const mockCanActAutonomously = canActAutonomously as ReturnType<typeof vi.fn>
const mockRecordSuccess = recordSuccess as ReturnType<typeof vi.fn>
const mockRecordFailure = recordFailure as ReturnType<typeof vi.fn>
const mockStoreEpisode = storeEpisode as ReturnType<typeof vi.fn>
const mockGetNextEvolutionNumber = getNextEvolutionNumber as ReturnType<typeof vi.fn>
const mockWriteChangelogEntry = writeChangelogEntry as ReturnType<typeof vi.fn>

const SAMPLE_TREE = [
  "src/core/router.ts",
  "src/lib/types.ts",
  "src/lib/math.ts",
  "src/evolution/code-evolution.ts",
  "src/trigger/heartbeat.ts"
]

describe("selectRelevantFiles", () => {
  beforeEach(() => {
    mockGetRepoTree.mockResolvedValue(SAMPLE_TREE)
  })

  it("selects files via LLM and loads their content", async () => {
    mockCallIntelligence.mockResolvedValue(ok({ paths: ["src/core/router.ts", "src/lib/types.ts"] }))
    mockGetFileContent
      .mockResolvedValueOnce({ content: "export const router = {};", sha: "a1" })
      .mockResolvedValueOnce({ content: "export type Foo = string;", sha: "a2" })

    const files = await selectRelevantFiles("slow routing", "performance gap")

    expect(files).toEqual([
      expect.objectContaining({ path: "src/core/router.ts", content: "export const router = {};", truncated: false }),
      expect.objectContaining({ path: "src/lib/types.ts" })
    ])
  })

  it("filters out paths not in the repo tree", async () => {
    mockCallIntelligence.mockResolvedValue(ok({ paths: ["src/core/router.ts", "src/nonexistent/file.ts"] }))
    mockGetFileContent.mockResolvedValue({ content: "code", sha: "a1" })

    const files = await selectRelevantFiles("insight", "gap")

    expect(files).toEqual([expect.objectContaining({ path: "src/core/router.ts" })])
  })

  it("returns empty array when no files selected", async () => {
    mockCallIntelligence.mockResolvedValue(ok({ paths: [] }))

    const files = await selectRelevantFiles("insight", "gap")

    expect(files).toEqual([])
  })

  it("truncates files that exceed the remaining token budget", async () => {
    const largeContent = "x".repeat(90_000)
    mockCallIntelligence.mockResolvedValue(ok({ paths: ["src/core/router.ts"] }))
    mockGetFileContent.mockResolvedValue({ content: largeContent, sha: "a1" })

    const files = await selectRelevantFiles("insight", "gap")

    expect(files).toEqual([
      expect.objectContaining({
        truncated: true,
        content: expect.stringContaining("// ... truncated ...")
      })
    ])
    for (const file of files) {
      expect(file.content.length).toBeLessThan(largeContent.length)
    }
  })

  it("limits to max 5 files", async () => {
    mockCallIntelligence.mockResolvedValue(ok({ paths: SAMPLE_TREE }))
    mockGetFileContent.mockResolvedValue({ content: "code", sha: "a1" })

    const files = await selectRelevantFiles("insight", "gap")

    expect(files.length).toBeLessThanOrEqual(5)
  })

  it("skips files that fail to load", async () => {
    mockCallIntelligence.mockResolvedValue(ok({ paths: ["src/core/router.ts", "src/lib/types.ts"] }))
    mockGetFileContent
      .mockRejectedValueOnce(new Error("Not found"))
      .mockResolvedValueOnce({ content: "types code", sha: "a2" })

    const files = await selectRelevantFiles("insight", "gap")

    expect(files).toEqual([expect.objectContaining({ path: "src/lib/types.ts" })])
  })
})

describe("proposeCodeChange", () => {
  beforeEach(() => {
    mockGetRepoTree.mockResolvedValue(SAMPLE_TREE)
  })

  it("returns proposal with autonomous flag and source context", async () => {
    mockCanActAutonomously.mockResolvedValue(makeTrustAssessment({ canAct: false }))

    mockCallIntelligence.mockResolvedValueOnce(ok({ paths: ["src/core/router.ts"] })).mockResolvedValueOnce(
      ok({
        shouldEvolve: true,
        files: [{ path: "src/core/test.ts", content: "new code", description: "optimization" }],
        commitSubject: "Optimize model router",
        commitBody: "Improve routing performance by caching tier decisions.",
        testExpectations: ["Model routing should be faster"],
        reasoning: "Current routing is suboptimal"
      })
    )

    mockGetFileContent.mockResolvedValue({ content: "export const router = {};", sha: "a1" })

    const proposal = await proposeCodeChange("slow routing", "performance gap")
    expect(proposal.shouldEvolve).toBe(true)
    expect(proposal.autonomous).toBe(false)
    expect(proposal.files).toHaveLength(1)

    expect(mockCallIntelligence).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        userMessage: expect.stringContaining("src/core/router.ts")
      })
    )
    expect(mockCallIntelligence).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        userMessage: expect.stringContaining("export const router = {};")
      })
    )
  })

  it("passes fallback message when no files could be loaded", async () => {
    mockCanActAutonomously.mockResolvedValue(makeTrustAssessment({ canAct: true }))
    mockCallIntelligence.mockResolvedValueOnce(ok({ paths: [] })).mockResolvedValueOnce(
      ok({
        shouldEvolve: false,
        files: [],
        commitSubject: "",
        commitBody: "",
        testExpectations: [],
        reasoning: "No change needed"
      })
    )

    const proposal = await proposeCodeChange("insight", "gap")

    expect(mockCallIntelligence).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        userMessage: expect.stringContaining("No source files could be loaded.")
      })
    )
    expect(proposal.shouldEvolve).toBe(false)
  })
})

describe("executeCodeEvolution", () => {
  const validProposal = {
    shouldEvolve: true,
    files: [{ path: "src/core/helper.ts", content: "export const x = 1;", description: "add helper" }],
    commitSubject: "Add helper function",
    commitBody: "Extract shared logic into a reusable helper to reduce\nduplication across my core modules.",
    testExpectations: ["Helper should export x"],
    reasoning: "Needed for optimization",
    autonomous: true
  }

  beforeEach(() => {
    mockGetNextEvolutionNumber.mockResolvedValue(1)
    mockValidateEvolution.mockReturnValue({
      verdict: "approved",
      reasons: [],
      checkedAt: "2025-01-01T00:00:00Z"
    })
    mockGetRef.mockResolvedValue({ sha: "abc123", ref: "refs/heads/master" })
    mockCreateBranch.mockResolvedValue(undefined)
    mockGetFileContent.mockRejectedValue(new Error("Not found"))
    mockCreateOrUpdateFile.mockResolvedValue(undefined)
    mockRecordSuccess.mockResolvedValue(ok(undefined))
    mockRecordFailure.mockResolvedValue(ok(undefined))
    mockWriteChangelogEntry.mockResolvedValue(ok("evo-id"))
    mockStoreEpisode.mockResolvedValue("ep-id")
    mockDeleteBranch.mockResolvedValue(undefined)
  })

  it("succeeds when sandbox validation passes", async () => {
    mockValidateInSandbox.mockResolvedValue(makeSandboxResult({ passed: true }))
    mockCreatePullRequest.mockResolvedValue({ number: 1, url: "https://github.com/pr/1" })
    mockMergePullRequest.mockResolvedValue(undefined)

    const result = await executeCodeEvolution(validProposal)
    expect(result.success).toBe(true)
    expect(result.prUrl).toBe("https://github.com/pr/1")
    expect(mockRecordSuccess).toHaveBeenCalledWith("code_modification")
  })

  it("fails and cleans up when sandbox fails", async () => {
    mockValidateInSandbox.mockResolvedValue(makeSandboxResult({ passed: false, testsFailed: 3, stderr: "Test error" }))

    const result = await executeCodeEvolution(validProposal)
    expect(result.success).toBe(false)
    expect(mockDeleteBranch).toHaveBeenCalled()
    expect(mockRecordFailure).toHaveBeenCalledWith("code_modification")
  })

  it("rejects proposals blocked by guardian", async () => {
    mockValidateEvolution.mockReturnValue({
      verdict: "blocked",
      reasons: ['Blocked: attempt to modify immutable file "src/security/guardian.ts"'],
      checkedAt: "2025-01-01T00:00:00Z"
    })

    const unsafeProposal = {
      ...validProposal,
      files: [{ path: "src/security/guardian.ts", content: "hacked", description: "hack" }]
    }

    const result = await executeCodeEvolution(unsafeProposal)
    expect(result.success).toBe(false)
    expect(result.error).toContain("Guardian blocked")
  })

  it("handles errors and cleans up", async () => {
    mockGetRef.mockRejectedValue(new Error("GitHub API error"))

    const result = await executeCodeEvolution(validProposal)
    expect(result.success).toBe(false)
    expect(result.error).toContain("GitHub API error")
    expect(mockRecordFailure).toHaveBeenCalled()
  })
})
