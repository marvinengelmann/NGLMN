vi.mock("@/db/client.ts", () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.from = vi.fn().mockReturnValue(chain)
  chain.orderBy = vi.fn().mockReturnValue(chain)
  chain.limit = vi.fn()
  return { db: chain }
})

vi.mock("@/memory/working.ts", () => ({
  getLastTickSummary: vi.fn(),
  getRecentRollbackCount: vi.fn().mockResolvedValue(0)
}))

import { db } from "@/db/client.ts"
import { makeEmotionalState, makeMetricsSnapshot } from "@/test/factories.ts"
import type { MockDbChain } from "@/test/mocks.ts"
import { checkEmotionalAccuracy, collectMetrics } from "./metrics.ts"

const mockDb = db as unknown as MockDbChain

beforeEach(() => {
  mockDb.limit.mockReset()
  mockDb.select.mockReturnValue(mockDb)
  mockDb.from.mockReturnValue(mockDb)
  mockDb.orderBy.mockReturnValue(mockDb)
})

describe("checkEmotionalAccuracy", () => {
  it("returns no discrepancies for consistent state", () => {
    const emotion = makeEmotionalState({ satisfaction: 0.8, frustration: 0.1 })
    const metrics = makeMetricsSnapshot({ errorRate: 0.05, interactionCount: 30 })
    const result = checkEmotionalAccuracy(emotion, metrics)
    expect(result).toHaveLength(0)
  })

  it("detects high satisfaction + high error rate", () => {
    const emotion = makeEmotionalState({ satisfaction: 0.8 })
    const metrics = makeMetricsSnapshot({ errorRate: 0.4 })
    const result = checkEmotionalAccuracy(emotion, metrics)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toContain("satisfaction")
  })

  it("detects low frustration + very high error rate", () => {
    const emotion = makeEmotionalState({ frustration: 0.1 })
    const metrics = makeMetricsSnapshot({ errorRate: 0.6 })
    const result = checkEmotionalAccuracy(emotion, metrics)
    expect(result.some((d) => d.includes("frustration"))).toBe(true)
  })

  it("detects high boredom + active interactions", () => {
    const emotion = makeEmotionalState({ boredom: 0.8 })
    const metrics = makeMetricsSnapshot({ interactionCount: 25 })
    const result = checkEmotionalAccuracy(emotion, metrics)
    expect(result.some((d) => d.includes("boredom"))).toBe(true)
  })

  it("detects high excitement during idle period", () => {
    const emotion = makeEmotionalState({ excitement: 0.9 })
    const metrics = makeMetricsSnapshot({ idleRatio: 0.9 })
    const result = checkEmotionalAccuracy(emotion, metrics)
    expect(result.some((d) => d.includes("excitement"))).toBe(true)
  })

  it("detects low caution despite rollbacks", () => {
    const emotion = makeEmotionalState({ caution: 0.2 })
    const metrics = makeMetricsSnapshot({ rollbackCount: 3 })
    const result = checkEmotionalAccuracy(emotion, metrics)
    expect(result.some((d) => d.includes("caution"))).toBe(true)
  })
})

describe("collectMetrics", () => {
  it("returns zero metrics when no ticks exist", async () => {
    mockDb.limit.mockResolvedValue([])
    const result = await collectMetrics()
    expect(result.tickCount).toBe(0)
    expect(result.errorRate).toBe(0)
    expect(result.idleRatio).toBe(1)
  })

  it("computes metrics from tick log", async () => {
    const ticks = [
      { triageDecision: "simple", responseSent: true, messagesProcessed: 1 },
      { triageDecision: "idle", responseSent: false, messagesProcessed: 0 },
      { triageDecision: "complex", responseSent: true, messagesProcessed: 2 },
      { triageDecision: "idle", responseSent: false, messagesProcessed: 0 }
    ]
    mockDb.limit.mockResolvedValue(ticks)
    const result = await collectMetrics()
    expect(result.tickCount).toBe(4)
    expect(result.idleRatio).toBe(0.5)
    expect(result.interactionCount).toBe(2)
  })
})
