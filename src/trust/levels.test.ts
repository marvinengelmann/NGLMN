vi.mock("@/db/client.ts", () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.from = vi.fn().mockReturnValue(chain)
  chain.where = vi.fn().mockReturnValue(chain)
  chain.limit = vi.fn()
  chain.insert = vi.fn().mockReturnValue(chain)
  chain.values = vi.fn()
  return { db: chain }
})

vi.mock("@/db/schema.ts", () => ({
  trustLevels: { actionType: "actionType" }
}))

import { db } from "@/db/client.ts"
import type { MockDbChain } from "@/test/mocks.ts"
import { ensureTrustLevel, getTrustLevel } from "./levels.ts"

const mockDb = db as unknown as MockDbChain

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.select.mockReturnValue(mockDb)
  mockDb.from.mockReturnValue(mockDb)
  mockDb.where.mockReturnValue(mockDb)
  mockDb.insert.mockReturnValue(mockDb)
})

describe("getTrustLevel", () => {
  it("returns defaults when no DB entry exists", async () => {
    mockDb.limit.mockResolvedValue([])

    const result = await getTrustLevel("add_goal")

    expect(result.fear).toBe(0.8)
    expect(result.confidence).toBe(0.1)
    expect(result.totalAttempts).toBe(0)
    expect(result.successfulAttempts).toBe(0)
  })

  it("returns DB row when entry exists", async () => {
    mockDb.limit.mockResolvedValue([
      { actionType: "add_goal", fear: 0.3, confidence: 0.7, totalAttempts: 15, successfulAttempts: 12 }
    ])

    const result = await getTrustLevel("add_goal")

    expect(result.fear).toBe(0.3)
    expect(result.confidence).toBe(0.7)
    expect(result.totalAttempts).toBe(15)
  })
})

describe("ensureTrustLevel", () => {
  it("inserts with defaults when no entry exists", async () => {
    mockDb.limit.mockResolvedValue([])
    mockDb.values.mockResolvedValue([])

    await ensureTrustLevel("git_commit")

    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "git_commit",
        fear: 0.8,
        confidence: 0.1
      })
    )
  })

  it("does not insert when entry already exists", async () => {
    mockDb.limit.mockResolvedValue([{ actionType: "git_commit" }])

    await ensureTrustLevel("git_commit")

    expect(mockDb.insert).not.toHaveBeenCalled()
  })
})
