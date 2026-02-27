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

vi.mock("@/core/intelligence.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/core/intelligence.ts")>()),
  callIntelligence: vi.fn()
}))

vi.mock("@/emotion/metrics-check.ts", () => ({
  collectMetrics: vi.fn()
}))

vi.mock("@/emotion/state.ts", () => ({
  getEmotionHistory: vi.fn(),
  getEmotionalState: vi.fn(),
  saveEmotionalState: vi.fn(),
  processEmotionTrigger: vi.fn()
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

import { subHours } from "date-fns"
import { ok } from "neverthrow"
import { callIntelligence } from "@/core/intelligence.ts"
import { getEmotionalState, processEmotionTrigger, saveEmotionalState } from "@/emotion/state.ts"
import { storeEpisode } from "@/memory/episodic.ts"
import { createGoal } from "@/memory/goals.ts"
import { storeKnowledge } from "@/memory/semantic.ts"
import { updateAdaptiveLayer } from "@/personality/evolution.ts"
import {
  makeEmotionalState,
  makePersonalityLayer,
  makeReflectionContext,
  makeReflectionInput
} from "@/test/factories.ts"
import { performReflection, shouldTriggerReflection } from "./reflection.ts"

const mockCallIntelligence = callIntelligence as ReturnType<typeof vi.fn>
const mockCreateGoal = createGoal as ReturnType<typeof vi.fn>
const mockStoreEpisode = storeEpisode as ReturnType<typeof vi.fn>
const mockStoreKnowledge = storeKnowledge as ReturnType<typeof vi.fn>
const mockUpdateAdaptiveLayer = updateAdaptiveLayer as ReturnType<typeof vi.fn>
const mockGetEmotionalState = getEmotionalState as ReturnType<typeof vi.fn>
const mockSaveEmotionalState = saveEmotionalState as ReturnType<typeof vi.fn>
const mockProcessEmotionTrigger = processEmotionTrigger as ReturnType<typeof vi.fn>

describe("performReflection", () => {
  beforeEach(() => {
    mockStoreEpisode.mockResolvedValue("ep-id")
    mockStoreKnowledge.mockResolvedValue(ok("sem-id"))
    mockCreateGoal.mockResolvedValue(ok("goal-id"))
    mockUpdateAdaptiveLayer.mockResolvedValue({})
  })

  it("processes reflection output and stores insights", async () => {
    mockCallIntelligence.mockResolvedValue(
      ok({
        insights: ["I should be more proactive in the morning"],
        personalityDeltas: null,
        newGoals: null,
        morningMessageDraft: null,
        emotionalCorrections: null
      })
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
    mockCallIntelligence.mockResolvedValue(
      ok({
        insights: ["Need more curiosity"],
        personalityDeltas: { curiosity: 0.05, caution: -0.03 },
        newGoals: null
      })
    )

    await performReflection(makeReflectionInput())
    expect(mockUpdateAdaptiveLayer).toHaveBeenCalledWith(
      { curiosity: 0.05, caution: -0.03 },
      expect.stringContaining("Dream reflection")
    )
  })

  it("creates new goals when suggested and emits new_goal trigger", async () => {
    mockGetEmotionalState.mockResolvedValue(makeEmotionalState())

    mockCallIntelligence.mockResolvedValue(
      ok({
        insights: ["Should explore ML"],
        newGoals: [{ title: "Learn ML basics", description: "Expand capabilities", priority: 0.6 }]
      })
    )

    await performReflection(makeReflectionInput())
    expect(mockCreateGoal).toHaveBeenCalledWith("Learn ML basics", "Expand capabilities", "dream", 0.6, {
      emotionalWeight: 0.6
    })
    expect(mockProcessEmotionTrigger).toHaveBeenCalledWith({ trigger: "new_goal", intensity: 0.5 }, "new_goal")
  })

  it("applies emotional corrections when present", async () => {
    const baseEmotion = makeEmotionalState({ frustration: 0.7, satisfaction: 0.3 })
    mockGetEmotionalState.mockResolvedValue(baseEmotion)

    mockCallIntelligence.mockResolvedValue(
      ok({
        insights: ["Frustration too high"],
        emotionalCorrections: { frustration: -0.2, satisfaction: 0.1 }
      })
    )

    await performReflection(makeReflectionInput())
    expect(mockSaveEmotionalState).toHaveBeenCalledWith(
      expect.objectContaining({
        frustration: expect.closeTo(0.5, 1),
        satisfaction: expect.closeTo(0.4, 1)
      }),
      "dream_correction"
    )
  })

  it("clamps emotional corrections to [0, 1]", async () => {
    const baseEmotion = makeEmotionalState({ caution: 0.95 })
    mockGetEmotionalState.mockResolvedValue(baseEmotion)

    mockCallIntelligence.mockResolvedValue(
      ok({
        insights: ["Test clamping"],
        emotionalCorrections: { caution: 0.2 }
      })
    )

    await performReflection(makeReflectionInput())
    expect(mockSaveEmotionalState).toHaveBeenCalledWith(expect.objectContaining({ caution: 1 }), "dream_correction")
  })

  it("ignores invalid personality dimensions", async () => {
    mockCallIntelligence.mockResolvedValue(
      ok({
        insights: ["Test"],
        personalityDeltas: { invalidDimension: 0.5, curiosity: 0.02 }
      })
    )

    await performReflection(makeReflectionInput())
    expect(mockUpdateAdaptiveLayer).toHaveBeenCalledWith({ curiosity: 0.02 }, expect.any(String))
  })
})

describe("shouldTriggerReflection", () => {
  it("triggers on high emotional intensity for introspective personality", () => {
    const ctx = makeReflectionContext({
      emotion: makeEmotionalState({ curiosity: 0.9 }),
      personality: makePersonalityLayer({ curiosity: 0.7, empathy: 0.75, abstraction: 0.6, proactivity: 0.3 })
    })

    const result = shouldTriggerReflection(ctx)
    expect(result.trigger).toBe(true)
    expect(result.reason).toContain("curiosity")
    expect(result.reason).toContain("high")
  })

  it("triggers on low emotional intensity (far below neutral)", () => {
    const ctx = makeReflectionContext({
      emotion: makeEmotionalState({ satisfaction: 0.05 }),
      personality: makePersonalityLayer({ curiosity: 0.7, empathy: 0.75, abstraction: 0.6, proactivity: 0.3 })
    })

    const result = shouldTriggerReflection(ctx)
    expect(result.trigger).toBe(true)
    expect(result.reason).toContain("satisfaction")
    expect(result.reason).toContain("low")
  })

  it("does not trigger when emotions are near neutral", () => {
    const ctx = makeReflectionContext({
      emotion: makeEmotionalState()
    })

    const result = shouldTriggerReflection(ctx)
    expect(result.trigger).toBe(false)
    expect(result.reason).toBe("No introspective urge")
  })

  it("respects cooldown period", () => {
    const ctx = makeReflectionContext({
      emotion: makeEmotionalState({ curiosity: 0.95 }),
      lastReflectionAt: new Date().toISOString()
    })

    const result = shouldTriggerReflection(ctx)
    expect(result.trigger).toBe(false)
    expect(result.reason).toContain("cooldown")
  })

  it("triggers after cooldown has passed", () => {
    const ctx = makeReflectionContext({
      emotion: makeEmotionalState({ curiosity: 0.95 }),
      personality: makePersonalityLayer({ curiosity: 0.7, empathy: 0.7, abstraction: 0.5, proactivity: 0.3 }),
      lastReflectionAt: subHours(new Date(), 5).toISOString()
    })

    const result = shouldTriggerReflection(ctx)
    expect(result.trigger).toBe(true)
  })

  it("triggers on emotional dissonance: excitement + caution", () => {
    const ctx = makeReflectionContext({
      emotion: makeEmotionalState({ excitement: 0.75, caution: 0.75 })
    })

    const result = shouldTriggerReflection(ctx)
    expect(result.trigger).toBe(true)
    expect(result.reason).toContain("dissonance")
    expect(result.reason).toContain("excitement")
    expect(result.reason).toContain("caution")
  })

  it("triggers on emotional dissonance: connection + frustration", () => {
    const ctx = makeReflectionContext({
      emotion: makeEmotionalState({ connection: 0.75, frustration: 0.75 })
    })

    const result = shouldTriggerReflection(ctx)
    expect(result.trigger).toBe(true)
    expect(result.reason).toContain("connected")
    expect(result.reason).toContain("frustrated")
  })

  it("triggers on emotional dissonance: curiosity + boredom", () => {
    const ctx = makeReflectionContext({
      emotion: makeEmotionalState({ curiosity: 0.75, boredom: 0.75 })
    })

    const result = shouldTriggerReflection(ctx)
    expect(result.trigger).toBe(true)
    expect(result.reason).toContain("curious")
    expect(result.reason).toContain("bored")
  })

  it("requires higher intensity for less introspective personality", () => {
    const lowDrivePersonality = makePersonalityLayer({
      curiosity: 0.3,
      empathy: 0.25,
      abstraction: 0.2,
      proactivity: 0.8
    })

    const notEnough = makeReflectionContext({
      emotion: makeEmotionalState({ excitement: 0.75 }),
      personality: lowDrivePersonality
    })
    expect(shouldTriggerReflection(notEnough).trigger).toBe(false)

    const enough = makeReflectionContext({
      emotion: makeEmotionalState({ excitement: 0.9 }),
      personality: lowDrivePersonality
    })
    expect(shouldTriggerReflection(enough).trigger).toBe(true)
  })
})
