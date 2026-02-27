vi.mock("@/integrations/redis.ts", () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn()
  }
}))

import { formatISO } from "date-fns"
import { redis } from "@/integrations/redis.ts"
import { estimateCallCost, getBudgetState, trackApiCost } from "./budget.ts"

const mockRedis = redis as unknown as {
  get: ReturnType<typeof vi.fn>
  set: ReturnType<typeof vi.fn>
}

const todayKey = `working:budget:${formatISO(new Date(), { representation: "date" })}`

describe("getBudgetState", () => {
  it("returns correct calculation from Redis value", async () => {
    mockRedis.get.mockResolvedValue(3.5)
    const state = await getBudgetState()
    expect(state.consumedToday).toBe(3.5)
    expect(state.dailyLimit).toBe(8.0)
    expect(state.remainingToday).toBe(4.5)
    expect(mockRedis.get).toHaveBeenCalledWith(todayKey)
  })

  it("returns 0 consumed when Redis returns null", async () => {
    mockRedis.get.mockResolvedValue(null)
    const state = await getBudgetState()
    expect(state.consumedToday).toBe(0)
    expect(state.remainingToday).toBe(8.0)
  })
})

describe("trackApiCost", () => {
  it("reads current value, adds cost, and stores as number with 24h TTL", async () => {
    mockRedis.get.mockResolvedValue(1.45)
    mockRedis.set.mockResolvedValue("OK")
    await trackApiCost(0.05)
    expect(mockRedis.get).toHaveBeenCalledWith(todayKey)
    expect(mockRedis.set).toHaveBeenCalledWith(todayKey, 1.5, { ex: 86_400 })
  })

  it("coerces string values from Redis before adding", async () => {
    mockRedis.get.mockResolvedValue("1.45")
    mockRedis.set.mockResolvedValue("OK")
    await trackApiCost(0.05)
    expect(mockRedis.set).toHaveBeenCalledWith(todayKey, 1.5, { ex: 86_400 })
  })
})

describe("estimateCallCost", () => {
  it("returns 0 for unknown model", () => {
    const cost = estimateCallCost("unknown-model", { inputTokens: 1000, outputTokens: 500 })
    expect(cost).toBe(0)
  })

  it("calculates cost for known model", () => {
    const usage = { inputTokens: 1000, outputTokens: 500 }
    const cost = estimateCallCost("xai/grok-4-1-fast-non-reasoning", usage)
    expect(cost).toBeGreaterThan(0)
  })

  it("returns same cost for both grok models (identical pricing)", () => {
    const usage = { inputTokens: 1000, outputTokens: 500 }
    const fastCost = estimateCallCost("xai/grok-4-1-fast-non-reasoning", usage)
    const reasoningCost = estimateCallCost("xai/grok-4-1-fast-reasoning", usage)
    expect(fastCost).toBe(reasoningCost)
  })
})
