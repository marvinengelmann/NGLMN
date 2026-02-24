vi.mock("@/db/client.ts", () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.from = vi.fn().mockReturnValue(chain)
  chain.where = vi.fn().mockReturnValue(chain)
  chain.orderBy = vi.fn().mockReturnValue(chain)
  chain.limit = vi.fn().mockResolvedValue([])
  // biome-ignore lint/suspicious/noThenProperty: mock chain needs thenable for Drizzle
  chain.then = vi.fn((resolve: (v: unknown) => void) => resolve([]))
  return { db: chain }
})

vi.mock("@/integrations/anthropic.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/integrations/anthropic.ts")>()),
  callClaude: vi.fn()
}))

vi.mock("@/emotion/metrics-check.ts", () => ({
  collectMetrics: vi.fn()
}))

vi.mock("@/emotion/state.ts", () => ({
  getEmotionHistory: vi.fn(),
  getEmotionalState: vi.fn(),
  saveEmotionalState: vi.fn()
}))

vi.mock("@/memory/goals.ts", () => ({
  getActiveGoals: vi.fn(),
  createGoal: vi.fn()
}))

vi.mock("@/memory/episodic.ts", () => ({
  storeEpisode: vi.fn()
}))

vi.mock("@/memory/semantic.ts", () => ({
  storeKnowledge: vi.fn()
}))

vi.mock("@/core/budget.ts", () => ({
  getBudgetState: vi.fn()
}))

vi.mock("@/personality/evolution.ts", () => ({
  updateAdaptiveLayer: vi.fn()
}))

vi.mock("@/memory/working.ts", () => ({
  getRecentRollbackCount: vi.fn().mockResolvedValue(0)
}))

import { ok } from "neverthrow"
import { getEmotionalState, saveEmotionalState } from "@/emotion/state.ts"
import { callClaude } from "@/integrations/anthropic.ts"
import { storeEpisode } from "@/memory/episodic.ts"
import { createGoal } from "@/memory/goals.ts"
import { storeKnowledge } from "@/memory/semantic.ts"
import { updateAdaptiveLayer } from "@/personality/evolution.ts"
import { makeEmotionalState, makeReflectionInput } from "@/test/factories.ts"
import { performReflection, shouldTriggerReflection } from "./reflection.ts"

const mockCallClaude = callClaude as ReturnType<typeof vi.fn>
const mockCreateGoal = createGoal as ReturnType<typeof vi.fn>
const mockStoreEpisode = storeEpisode as ReturnType<typeof vi.fn>
const mockStoreKnowledge = storeKnowledge as ReturnType<typeof vi.fn>
const mockUpdateAdaptiveLayer = updateAdaptiveLayer as ReturnType<typeof vi.fn>
const mockGetEmotionalState = getEmotionalState as ReturnType<typeof vi.fn>
const mockSaveEmotionalState = saveEmotionalState as ReturnType<typeof vi.fn>

describe("performReflection", () => {
  beforeEach(() => {
    mockStoreEpisode.mockResolvedValue("ep-id")
    mockStoreKnowledge.mockResolvedValue(ok("sem-id"))
    mockCreateGoal.mockResolvedValue(ok("goal-id"))
    mockUpdateAdaptiveLayer.mockResolvedValue({})
  })

  it("processes reflection output and stores insights", async () => {
    mockCallClaude.mockResolvedValue(
      ok(
        JSON.stringify({
          insights: ["I should be more proactive in the morning"],
          personalityDeltas: null,
          newGoals: null,
          morningMessageDraft: null,
          emotionalCorrections: null
        })
      )
    )

    const input = makeReflectionInput()
    const output = await performReflection(input)

    expect(output.insights).toHaveLength(1)
    expect(mockStoreEpisode).toHaveBeenCalledWith(
      "Reflection insight: I should be more proactive in the morning",
      "dream",
      { relevanceScore: 0.85 }
    )
    expect(mockStoreKnowledge).toHaveBeenCalled()
  })

  it("applies personality deltas when present", async () => {
    mockCallClaude.mockResolvedValue(
      ok(
        JSON.stringify({
          insights: ["Need more curiosity"],
          personalityDeltas: { curiosity: 0.05, caution: -0.03 },
          newGoals: null
        })
      )
    )

    await performReflection(makeReflectionInput())
    expect(mockUpdateAdaptiveLayer).toHaveBeenCalledWith(
      { curiosity: 0.05, caution: -0.03 },
      expect.stringContaining("Dream reflection")
    )
  })

  it("creates new goals when suggested", async () => {
    mockCallClaude.mockResolvedValue(
      ok(
        JSON.stringify({
          insights: ["Should explore ML"],
          newGoals: [{ title: "Learn ML basics", description: "Expand capabilities", priority: 0.6 }]
        })
      )
    )

    await performReflection(makeReflectionInput())
    expect(mockCreateGoal).toHaveBeenCalledWith("Learn ML basics", "Expand capabilities", "dream", 0.6, {
      emotionalWeight: 0.6
    })
  })

  it("applies emotional corrections when present", async () => {
    const baseEmotion = makeEmotionalState({ frustration: 0.7, satisfaction: 0.3 })
    mockGetEmotionalState.mockResolvedValue(baseEmotion)

    mockCallClaude.mockResolvedValue(
      ok(
        JSON.stringify({
          insights: ["Frustration too high"],
          emotionalCorrections: { frustration: -0.2, satisfaction: 0.1 }
        })
      )
    )

    await performReflection(makeReflectionInput())
    expect(mockSaveEmotionalState).toHaveBeenCalledWith(
      expect.objectContaining({
        frustration: expect.closeTo(0.5, 1),
        satisfaction: expect.closeTo(0.4, 1)
      }),
      "tick_start"
    )
  })

  it("clamps emotional corrections to [0, 1]", async () => {
    const baseEmotion = makeEmotionalState({ caution: 0.95 })
    mockGetEmotionalState.mockResolvedValue(baseEmotion)

    mockCallClaude.mockResolvedValue(
      ok(
        JSON.stringify({
          insights: ["Test clamping"],
          emotionalCorrections: { caution: 0.2 }
        })
      )
    )

    await performReflection(makeReflectionInput())
    expect(mockSaveEmotionalState).toHaveBeenCalledWith(expect.objectContaining({ caution: 1 }), "tick_start")
  })

  it("ignores invalid personality dimensions", async () => {
    mockCallClaude.mockResolvedValue(
      ok(
        JSON.stringify({
          insights: ["Test"],
          personalityDeltas: { invalidDimension: 0.5, curiosity: 0.02 }
        })
      )
    )

    await performReflection(makeReflectionInput())
    expect(mockUpdateAdaptiveLayer).toHaveBeenCalledWith({ curiosity: 0.02 }, expect.any(String))
  })
})

describe("shouldTriggerReflection", () => {
  it("triggers when failures >= 3", () => {
    const result = shouldTriggerReflection({ failures: 3, rollbacks: 0, budgetPercent: 50 })
    expect(result.trigger).toBe(true)
    expect(result.reason).toContain("3 recent failures")
  })

  it("triggers when rollbacks >= 2", () => {
    const result = shouldTriggerReflection({ failures: 0, rollbacks: 2, budgetPercent: 50 })
    expect(result.trigger).toBe(true)
    expect(result.reason).toContain("2 recent rollbacks")
  })

  it("triggers when budget exceeds 90%", () => {
    const result = shouldTriggerReflection({ failures: 0, rollbacks: 0, budgetPercent: 91 })
    expect(result.trigger).toBe(true)
    expect(result.reason).toContain("Budget at 91%")
  })

  it("does not trigger when all values are below thresholds", () => {
    const result = shouldTriggerReflection({ failures: 2, rollbacks: 1, budgetPercent: 89 })
    expect(result.trigger).toBe(false)
    expect(result.reason).toBe("No reflection trigger met")
  })

  it("prioritizes failures check over rollbacks", () => {
    const result = shouldTriggerReflection({ failures: 3, rollbacks: 5, budgetPercent: 95 })
    expect(result.trigger).toBe(true)
    expect(result.reason).toContain("failures")
  })

  it("checks rollbacks before budget when failures are below threshold", () => {
    const result = shouldTriggerReflection({ failures: 1, rollbacks: 2, budgetPercent: 95 })
    expect(result.trigger).toBe(true)
    expect(result.reason).toContain("rollbacks")
  })
})
