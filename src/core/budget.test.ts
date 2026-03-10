import { afterEach, describe, expect, it, vi } from "vitest"
import { BUDGET } from "@/infra/config/constants.ts"

vi.mock("@/infra/integrations/redis.ts", () => ({
  redis: {
    get: vi.fn(),
    incrbyfloat: vi.fn(),
    expire: vi.fn()
  }
}))

import { redis } from "@/infra/integrations/redis.ts"
import { estimateCallCost, getBudgetState, trackApiCost } from "./budget.ts"

const mockedRedis = vi.mocked(redis)

afterEach(() => {
  vi.clearAllMocks()
})

describe("estimateCallCost", () => {
  it("calculates cost for given token usage", () => {
    const cost = estimateCallCost({ inputTokens: 1_000_000, outputTokens: 1_000_000 })
    expect(cost).toBeCloseTo(0.7)
  })

  it("returns 0 for zero tokens", () => {
    expect(estimateCallCost({ inputTokens: 0, outputTokens: 0 })).toBe(0)
  })

  it("handles input-only usage", () => {
    const cost = estimateCallCost({ inputTokens: 500_000, outputTokens: 0 })
    expect(cost).toBeCloseTo(0.1)
  })

  it("handles output-only usage", () => {
    const cost = estimateCallCost({ inputTokens: 0, outputTokens: 500_000 })
    expect(cost).toBeCloseTo(0.25)
  })
})

describe("trackApiCost", () => {
  it("calls redis incrbyfloat and expire", async () => {
    mockedRedis.incrbyfloat.mockResolvedValue(1.5)
    mockedRedis.expire.mockResolvedValue(1)

    await trackApiCost(0.5)

    expect(mockedRedis.incrbyfloat).toHaveBeenCalledOnce()
    expect(mockedRedis.incrbyfloat).toHaveBeenCalledWith(expect.stringContaining("working:budget:"), 0.5)
    expect(mockedRedis.expire).toHaveBeenCalledOnce()
    expect(mockedRedis.expire).toHaveBeenCalledWith(expect.stringContaining("working:budget:"), 86_400)
  })
})

describe("getBudgetState", () => {
  it("returns budget state with consumed amount from Redis", async () => {
    mockedRedis.get.mockResolvedValue("2.5")
    const state = await getBudgetState()
    expect(state.consumedToday).toBe(2.5)
    expect(state.dailyLimit).toBe(BUDGET.DAILY_LIMIT)
    expect(state.remainingToday).toBeCloseTo(BUDGET.DAILY_LIMIT - 2.5)
  })

  it("returns 0 consumed when Redis returns null", async () => {
    mockedRedis.get.mockResolvedValue(null)
    const state = await getBudgetState()
    expect(state.consumedToday).toBe(0)
    expect(state.remainingToday).toBe(BUDGET.DAILY_LIMIT)
  })

  it("clamps remainingToday to 0 when over budget", async () => {
    mockedRedis.get.mockResolvedValue("10.0")
    const state = await getBudgetState()
    expect(state.remainingToday).toBe(0)
  })
})
