vi.mock("@/integrations/github.ts", () => ({
  getRef: vi.fn(),
  updateRef: vi.fn(),
  listCommits: vi.fn()
}))

vi.mock("@/memory/working.ts", () => ({
  getLastHealthyCommit: vi.fn(),
  pushRollbackEvent: vi.fn().mockResolvedValue(undefined)
}))

import { getRef, listCommits, updateRef } from "@/integrations/github.ts"
import { performRollback } from "./rollback.ts"

const mockGetRef = getRef as ReturnType<typeof vi.fn>
const mockUpdateRef = updateRef as ReturnType<typeof vi.fn>
const mockListCommits = listCommits as ReturnType<typeof vi.fn>

describe("performRollback — soft", () => {
  it("reverts GitHub to previous commit", async () => {
    mockListCommits.mockResolvedValue([
      { sha: "aaa111", message: "latest commit", date: "2026-01-02" },
      { sha: "bbb222", message: "previous commit", date: "2026-01-01" },
      { sha: "ccc333", message: "old commit", date: "2025-12-31" }
    ])
    mockUpdateRef.mockResolvedValue(undefined)

    const result = await performRollback("soft")
    expect(result.tier).toBe("soft")
    expect(result.success).toBe(true)
    expect(result.actions.length).toBeGreaterThan(0)
    expect(mockUpdateRef).toHaveBeenCalledWith("heads/master", "bbb222", true)
  })

  it("records error when fewer than 2 commits", async () => {
    mockListCommits.mockResolvedValue([{ sha: "aaa111", message: "only commit", date: "2026-01-01" }])

    const result = await performRollback("soft")
    expect(result.success).toBe(false)
    expect(result.errors.some((e) => e.includes("Not enough commits"))).toBe(true)
  })

  it("returns correct RollbackResult structure", async () => {
    mockListCommits.mockResolvedValue([
      { sha: "aaa111", message: "latest", date: "2026-01-02" },
      { sha: "bbb222", message: "prev", date: "2026-01-01" }
    ])
    mockUpdateRef.mockResolvedValue(undefined)

    const result = await performRollback("soft")
    expect(result).toHaveProperty("tier", "soft")
    expect(result).toHaveProperty("success")
    expect(result).toHaveProperty("actions")
    expect(result).toHaveProperty("errors")
    expect(result).toHaveProperty("timestamp")
    expect(Array.isArray(result.actions)).toBe(true)
    expect(Array.isArray(result.errors)).toBe(true)
  })
})

describe("performRollback — hard", () => {
  it("uses last-stable tag to reset", async () => {
    mockGetRef.mockResolvedValue({ sha: "stable-sha", ref: "tags/last-stable" })
    mockUpdateRef.mockResolvedValue(undefined)

    const result = await performRollback("hard")
    expect(result.tier).toBe("hard")
    expect(result.success).toBe(true)
    expect(mockUpdateRef).toHaveBeenCalledWith("heads/master", "stable-sha", true)
    expect(result.actions.some((a) => a.includes("last-stable"))).toBe(true)
  })

  it("records error when last-stable tag is missing", async () => {
    mockGetRef.mockRejectedValue(new Error("Not found"))

    const result = await performRollback("hard")
    expect(result.success).toBe(false)
    expect(result.errors.some((e) => e.includes("Hard rollback GitHub"))).toBe(true)
  })
})
