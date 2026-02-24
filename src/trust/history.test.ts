vi.mock("@/db/client.ts", () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.from = vi.fn().mockReturnValue(chain)
  chain.where = vi.fn().mockReturnValue(chain)
  chain.limit = vi.fn()
  chain.insert = vi.fn().mockReturnValue(chain)
  chain.values = vi.fn()
  chain.update = vi.fn().mockReturnValue(chain)
  chain.set = vi.fn().mockReturnValue(chain)
  chain.transaction = vi.fn().mockImplementation((fn: (tx: typeof chain) => Promise<unknown>) => fn(chain))
  return { db: chain }
})

vi.mock("./levels.ts", () => ({
  ensureTrustLevel: vi.fn()
}))

import { db } from "@/db/client.ts"
import type { MockDbChain } from "@/test/mocks.ts"
import { recordFailure, recordSuccess } from "./history.ts"

const mockDb = db as unknown as MockDbChain

beforeEach(() => {
  mockDb.limit.mockReset()
  mockDb.set.mockReset().mockReturnValue(mockDb)
  mockDb.where.mockReset().mockReturnValue(mockDb)
  mockDb.select.mockReturnValue(mockDb)
  mockDb.from.mockReturnValue(mockDb)
  mockDb.update.mockReturnValue(mockDb)
  mockDb.insert.mockReturnValue(mockDb)
  mockDb.values.mockReset()
})

describe("recordSuccess", () => {
  it("decreases fear and increases confidence", async () => {
    mockDb.limit.mockResolvedValue([
      {
        actionType: "add_goal",
        fear: 0.8,
        confidence: 0.2,
        totalAttempts: 5,
        successfulAttempts: 3
      }
    ])
    const result = await recordSuccess("add_goal")
    expect(result.isOk()).toBe(true)
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        fear: 0.75,
        confidence: 0.23,
        totalAttempts: 6,
        successfulAttempts: 4
      })
    )
  })

  it("clamps fear to minimum 0", async () => {
    mockDb.limit.mockResolvedValue([
      {
        actionType: "add_goal",
        fear: 0.02,
        confidence: 0.9,
        totalAttempts: 100,
        successfulAttempts: 99
      }
    ])
    const result = await recordSuccess("add_goal")
    expect(result.isOk()).toBe(true)
    expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({ fear: 0 }))
  })
})

describe("recordFailure", () => {
  it("increases fear and decreases confidence", async () => {
    mockDb.limit.mockResolvedValue([
      {
        actionType: "git_commit",
        fear: 0.5,
        confidence: 0.4,
        totalAttempts: 10,
        successfulAttempts: 8
      }
    ])
    const result = await recordFailure("git_commit")
    expect(result.isOk()).toBe(true)
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        fear: 0.6,
        totalAttempts: 11
      })
    )
    const setCall = mockDb.set.mock.calls[0]?.[0]
    expect(setCall.confidence).toBeCloseTo(0.35)
  })

  it("clamps confidence to minimum 0", async () => {
    mockDb.limit.mockResolvedValue([
      {
        actionType: "deployment",
        fear: 0.9,
        confidence: 0.02,
        totalAttempts: 5,
        successfulAttempts: 1
      }
    ])
    const result = await recordFailure("deployment")
    expect(result.isOk()).toBe(true)
    expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({ confidence: 0 }))
  })

  it("clamps fear to maximum 1", async () => {
    mockDb.limit.mockResolvedValue([
      {
        actionType: "code_modification",
        fear: 0.95,
        confidence: 0.1,
        totalAttempts: 3,
        successfulAttempts: 0
      }
    ])
    const result = await recordFailure("code_modification")
    expect(result.isOk()).toBe(true)
    expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({ fear: 1 }))
  })
})
