import { makeTriageResult } from "@/test/factories.ts"

vi.mock("@/core/budget.ts", () => ({
  getBudgetState: vi.fn()
}))

import { getBudgetState } from "@/core/budget.ts"
import { HAIKU, OPUS, SONNET } from "@/integrations/anthropic.ts"
import { selectModel } from "./model-router.ts"

const mockGetBudgetState = getBudgetState as ReturnType<typeof vi.fn>

describe("selectModel", () => {
  it("returns HAIKU for idle", async () => {
    mockGetBudgetState.mockResolvedValue({ consumedToday: 0, dailyLimit: 8.0, remainingToday: 8.0 })
    const result = await selectModel(makeTriageResult({ decision: "idle" }))
    expect(result).toBe(HAIKU)
  })

  it("returns HAIKU for simple", async () => {
    mockGetBudgetState.mockResolvedValue({ consumedToday: 0, dailyLimit: 8.0, remainingToday: 8.0 })
    const result = await selectModel(makeTriageResult({ decision: "simple" }))
    expect(result).toBe(HAIKU)
  })

  it("returns SONNET for complex", async () => {
    mockGetBudgetState.mockResolvedValue({ consumedToday: 0, dailyLimit: 8.0, remainingToday: 8.0 })
    const result = await selectModel(makeTriageResult({ decision: "complex" }))
    expect(result).toBe(SONNET)
  })

  it("returns OPUS for deep", async () => {
    mockGetBudgetState.mockResolvedValue({ consumedToday: 0, dailyLimit: 8.0, remainingToday: 8.0 })
    const result = await selectModel(makeTriageResult({ decision: "deep" }))
    expect(result).toBe(OPUS)
  })

  it("returns HAIKU when budget < 10% regardless of decision", async () => {
    mockGetBudgetState.mockResolvedValue({ consumedToday: 7.5, dailyLimit: 8.0, remainingToday: 0.5 })
    const result = await selectModel(makeTriageResult({ decision: "deep" }))
    expect(result).toBe(HAIKU)
  })
})
