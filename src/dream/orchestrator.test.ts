vi.mock("@/db/client.ts", () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain.insert = vi.fn().mockReturnValue(chain)
  chain.values = vi.fn().mockResolvedValue([])
  return { db: chain }
})

vi.mock("@/emotion/state.ts", () => ({
  getEmotionalState: vi.fn()
}))

vi.mock("@/emotion/metrics-check.ts", () => ({
  collectMetrics: vi.fn()
}))

vi.mock("@/memory/working.ts", () => ({
  getDreamState: vi.fn(),
  setDreamState: vi.fn(),
  setDreamLastRun: vi.fn(),
  setDreamInsights: vi.fn()
}))

vi.mock("./consolidation.ts", () => ({
  consolidateMemories: vi.fn()
}))

vi.mock("./creative.ts", () => ({
  findCreativeConnections: vi.fn()
}))

vi.mock("./reflection.ts", () => ({
  buildReflectionInput: vi.fn(),
  performReflection: vi.fn()
}))

import { collectMetrics } from "@/emotion/metrics-check.ts"
import { getEmotionalState } from "@/emotion/state.ts"
import { getDreamState, setDreamInsights, setDreamLastRun, setDreamState } from "@/memory/working.ts"
import {
  makeConsolidationResult,
  makeEmotionalState,
  makeMetricsSnapshot,
  makeReflectionInput,
  makeReflectionOutput
} from "@/test/factories.ts"
import { consolidateMemories } from "./consolidation.ts"
import { findCreativeConnections } from "./creative.ts"
import { isDreamTime, runDreamCycle } from "./orchestrator.ts"
import { buildReflectionInput, performReflection } from "./reflection.ts"

const mockGetDreamState = getDreamState as ReturnType<typeof vi.fn>
const mockSetDreamState = setDreamState as ReturnType<typeof vi.fn>
const mockSetDreamLastRun = setDreamLastRun as ReturnType<typeof vi.fn>
const mockSetDreamInsights = setDreamInsights as ReturnType<typeof vi.fn>
const mockGetEmotionalState = getEmotionalState as ReturnType<typeof vi.fn>
const mockConsolidateMemories = consolidateMemories as ReturnType<typeof vi.fn>
const mockFindCreativeConnections = findCreativeConnections as ReturnType<typeof vi.fn>
const mockBuildReflectionInput = buildReflectionInput as ReturnType<typeof vi.fn>
const mockPerformReflection = performReflection as ReturnType<typeof vi.fn>
const mockCollectMetrics = collectMetrics as ReturnType<typeof vi.fn>

describe("isDreamTime", () => {
  it("is a function that returns a boolean", () => {
    expect(typeof isDreamTime()).toBe("boolean")
  })
})

describe("runDreamCycle", () => {
  beforeEach(() => {
    mockGetDreamState.mockResolvedValue("idle")
    mockSetDreamState.mockResolvedValue(undefined)
    mockSetDreamLastRun.mockResolvedValue(undefined)
    mockSetDreamInsights.mockResolvedValue(undefined)
    mockGetEmotionalState.mockResolvedValue(makeEmotionalState())
    mockCollectMetrics.mockResolvedValue(makeMetricsSnapshot())
  })

  it("aborts if already dreaming", async () => {
    mockGetDreamState.mockResolvedValue("dreaming")
    const result = await runDreamCycle()
    expect(result.errors).toContain("Dream cycle already in progress")
    expect(mockConsolidateMemories).not.toHaveBeenCalled()
  })

  it("runs all three phases in sequence", async () => {
    mockConsolidateMemories.mockResolvedValue(makeConsolidationResult())
    mockFindCreativeConnections.mockResolvedValue({
      connectionsFound: 3,
      goalsCreated: 1,
      insightsStored: 2
    })
    mockBuildReflectionInput.mockResolvedValue(makeReflectionInput())
    mockPerformReflection.mockResolvedValue(makeReflectionOutput())

    const result = await runDreamCycle()

    expect(result.consolidation).not.toBeNull()
    expect(result.creative).not.toBeNull()
    expect(result.reflection).not.toBeNull()
    expect(result.errors).toHaveLength(0)
  })

  it("sets dream state transitions correctly", async () => {
    mockConsolidateMemories.mockResolvedValue(makeConsolidationResult())
    mockFindCreativeConnections.mockResolvedValue({ connectionsFound: 0, goalsCreated: 0, insightsStored: 0 })
    mockBuildReflectionInput.mockResolvedValue(makeReflectionInput())
    mockPerformReflection.mockResolvedValue(makeReflectionOutput())

    await runDreamCycle()

    expect(mockSetDreamState).toHaveBeenCalledWith("dreaming")
    expect(mockSetDreamState).toHaveBeenCalledWith("waking")
    expect(mockSetDreamLastRun).toHaveBeenCalled()
  })

  it("continues when consolidation fails", async () => {
    mockConsolidateMemories.mockRejectedValue(new Error("consolidation error"))
    mockFindCreativeConnections.mockResolvedValue({ connectionsFound: 1, goalsCreated: 0, insightsStored: 1 })
    mockBuildReflectionInput.mockResolvedValue(makeReflectionInput())
    mockPerformReflection.mockResolvedValue(makeReflectionOutput())

    const result = await runDreamCycle()

    expect(result.consolidation).toBeNull()
    expect(result.creative).not.toBeNull()
    expect(result.reflection).not.toBeNull()
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain("Consolidation failed")
  })

  it("continues when creative connections fail", async () => {
    mockConsolidateMemories.mockResolvedValue(makeConsolidationResult())
    mockFindCreativeConnections.mockRejectedValue(new Error("creative error"))
    mockBuildReflectionInput.mockResolvedValue(makeReflectionInput())
    mockPerformReflection.mockResolvedValue(makeReflectionOutput())

    const result = await runDreamCycle()

    expect(result.consolidation).not.toBeNull()
    expect(result.creative).toBeNull()
    expect(result.errors).toHaveLength(1)
  })

  it("stores dream insights for morning message", async () => {
    mockConsolidateMemories.mockResolvedValue(makeConsolidationResult())
    mockFindCreativeConnections.mockResolvedValue({ connectionsFound: 0, goalsCreated: 0, insightsStored: 0 })
    mockBuildReflectionInput.mockResolvedValue(makeReflectionInput())
    mockPerformReflection.mockResolvedValue(
      makeReflectionOutput({
        insights: ["Insight A", "Insight B"],
        morningMessageDraft: "Good morning draft"
      })
    )

    await runDreamCycle()

    expect(mockSetDreamInsights).toHaveBeenCalledWith(["Insight A", "Insight B", "Good morning draft"])
  })

  it("generates evolution triggers from capability insights", async () => {
    mockConsolidateMemories.mockResolvedValue(makeConsolidationResult())
    mockFindCreativeConnections.mockResolvedValue({ connectionsFound: 0, goalsCreated: 0, insightsStored: 0 })
    mockBuildReflectionInput.mockResolvedValue(makeReflectionInput())
    mockPerformReflection.mockResolvedValue(
      makeReflectionOutput({
        insights: ["I am missing the capability to parse PDFs"]
      })
    )

    const result = await runDreamCycle()
    expect(result.evolutionTriggers.length).toBeGreaterThan(0)
    expect(result.evolutionTriggers[0]?.type).toBe("code")
  })

  it("generates prompt evolution trigger on high error rate", async () => {
    mockCollectMetrics.mockResolvedValue(makeMetricsSnapshot({ errorRate: 0.5 }))
    mockConsolidateMemories.mockResolvedValue(makeConsolidationResult())
    mockFindCreativeConnections.mockResolvedValue({ connectionsFound: 0, goalsCreated: 0, insightsStored: 0 })
    mockBuildReflectionInput.mockResolvedValue(makeReflectionInput())
    mockPerformReflection.mockResolvedValue(makeReflectionOutput())

    const result = await runDreamCycle()
    const promptTrigger = result.evolutionTriggers.find((t) => t.type === "prompt")
    expect(promptTrigger).toBeDefined()
    expect(promptTrigger?.promptId).toBe("triage")
  })
})
