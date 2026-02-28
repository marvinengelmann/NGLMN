vi.mock("@/db/client.ts", () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain.insert = vi.fn().mockReturnValue(chain)
  chain.values = vi.fn().mockResolvedValue([])
  return { db: chain }
})

vi.mock("@/db/schema.ts", () => ({
  dreamLog: {}
}))

vi.mock("@/emotion/state.ts", () => ({
  getEmotionalState: vi.fn()
}))

vi.mock("@/emotion/metrics.ts", () => ({
  collectMetrics: vi.fn()
}))

vi.mock("@/lib/logger.ts", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}))

vi.mock("@/lib/sentry.ts", () => ({
  captureError: vi.fn()
}))

vi.mock("@/lib/time.ts", () => ({
  isDreamTime: vi.fn(() => true),
  nowISO: vi.fn(() => "2026-01-01T03:00:00+00:00")
}))

vi.mock("@/memory/working.ts", () => ({
  getDreamState: vi.fn(),
  setDreamState: vi.fn(),
  setDreamLastRun: vi.fn()
}))

vi.mock("./consolidation.ts", () => ({
  consolidateMemories: vi.fn()
}))

vi.mock("./creative.ts", () => ({
  findCreativeConnections: vi.fn()
}))

import { collectMetrics } from "@/emotion/metrics.ts"
import { getEmotionalState } from "@/emotion/state.ts"
import { captureError } from "@/lib/sentry.ts"
import { isDreamTime } from "@/lib/time.ts"
import { getDreamState, setDreamLastRun, setDreamState } from "@/memory/working.ts"
import { makeConsolidationResult, makeEmotionalState, makeMetricsSnapshot } from "@/test/factories.ts"
import { consolidateMemories } from "./consolidation.ts"
import { findCreativeConnections } from "./creative.ts"
import { runDreamCycle } from "./orchestrator.ts"

const mockIsDreamTime = isDreamTime as ReturnType<typeof vi.fn>
const mockGetDreamState = getDreamState as ReturnType<typeof vi.fn>
const mockSetDreamState = setDreamState as ReturnType<typeof vi.fn>
const mockSetDreamLastRun = setDreamLastRun as ReturnType<typeof vi.fn>
const mockGetEmotionalState = getEmotionalState as ReturnType<typeof vi.fn>
const mockConsolidateMemories = consolidateMemories as ReturnType<typeof vi.fn>
const mockFindCreativeConnections = findCreativeConnections as ReturnType<typeof vi.fn>
const mockCollectMetrics = collectMetrics as ReturnType<typeof vi.fn>
const mockCaptureError = captureError as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  mockIsDreamTime.mockReturnValue(true)
  mockGetDreamState.mockResolvedValue("idle")
  mockSetDreamState.mockResolvedValue(undefined)
  mockSetDreamLastRun.mockResolvedValue(undefined)
  mockGetEmotionalState.mockResolvedValue(makeEmotionalState())
  mockCollectMetrics.mockResolvedValue(makeMetricsSnapshot())
})

describe("runDreamCycle", () => {
  it("skips when not dream time", async () => {
    mockIsDreamTime.mockReturnValue(false)

    const result = await runDreamCycle()

    expect(result.action).toBe("skipped")
    expect(result.reason).toBe("not dream time")
    expect(mockConsolidateMemories).not.toHaveBeenCalled()
  })

  it("aborts if already dreaming", async () => {
    mockGetDreamState.mockResolvedValue("dreaming")
    const result = await runDreamCycle()
    expect(result.errors).toContain("Dream cycle already in progress")
    expect(mockConsolidateMemories).not.toHaveBeenCalled()
  })

  it("runs consolidation and creative phases in sequence", async () => {
    mockConsolidateMemories.mockResolvedValue(makeConsolidationResult())
    mockFindCreativeConnections.mockResolvedValue({
      connectionsFound: 3,
      goalsCreated: 1,
      insightsStored: 2
    })

    const result = await runDreamCycle()

    expect(result.action).toBe("completed")
    expect(result.consolidation).not.toBeNull()
    expect(result.creative).not.toBeNull()
    expect(result.errors).toHaveLength(0)
  })

  it("sets dream state transitions correctly", async () => {
    mockConsolidateMemories.mockResolvedValue(makeConsolidationResult())
    mockFindCreativeConnections.mockResolvedValue({ connectionsFound: 0, goalsCreated: 0, insightsStored: 0 })

    await runDreamCycle()

    expect(mockSetDreamState).toHaveBeenCalledWith("dreaming")
    expect(mockSetDreamState).toHaveBeenCalledWith("waking")
    expect(mockSetDreamLastRun).toHaveBeenCalled()
  })

  it("continues when consolidation fails and captures errors", async () => {
    mockConsolidateMemories.mockRejectedValue(new Error("consolidation error"))
    mockFindCreativeConnections.mockResolvedValue({ connectionsFound: 1, goalsCreated: 0, insightsStored: 1 })

    const result = await runDreamCycle()

    expect(result.consolidation).toBeNull()
    expect(result.creative).not.toBeNull()
    expect(result.errors).toHaveLength(1)
    expect(result.errors?.[0]).toContain("Consolidation failed")
    expect(mockCaptureError).toHaveBeenCalled()
  })

  it("continues when creative connections fail", async () => {
    mockConsolidateMemories.mockResolvedValue(makeConsolidationResult())
    mockFindCreativeConnections.mockRejectedValue(new Error("creative error"))

    const result = await runDreamCycle()

    expect(result.consolidation).not.toBeNull()
    expect(result.creative).toBeNull()
    expect(result.errors).toHaveLength(1)
  })
})
