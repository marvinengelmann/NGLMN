vi.mock("@/core/intelligence.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/core/intelligence.ts")>()),
  callIntelligence: vi.fn()
}))

vi.mock("@/memory/goals.ts", () => ({
  createGoal: vi.fn()
}))

vi.mock("@/memory/episodic.ts", () => ({
  storeEpisode: vi.fn()
}))

import { ok } from "neverthrow"
import { callIntelligence } from "@/core/intelligence.ts"
import { storeEpisode } from "@/memory/episodic.ts"
import { createGoal } from "@/memory/goals.ts"
import { makeEmotionalState } from "@/test/factories.ts"
import { createExplorationGoal, generateInterests, shouldExplore } from "./curiosity.ts"

const mockCallIntelligence = callIntelligence as ReturnType<typeof vi.fn>
const mockCreateGoal = createGoal as ReturnType<typeof vi.fn>
const mockStoreEpisode = storeEpisode as ReturnType<typeof vi.fn>

describe("shouldExplore", () => {
  it("returns true when all conditions met", () => {
    const emotion = makeEmotionalState({ curiosity: 0.8, boredom: 0.7, caution: 0.3 })
    expect(shouldExplore(emotion)).toBe(true)
  })

  it("returns false when any condition fails", () => {
    expect(shouldExplore(makeEmotionalState({ curiosity: 0.4, boredom: 0.7, caution: 0.3 }))).toBe(false)
    expect(shouldExplore(makeEmotionalState({ curiosity: 0.8, boredom: 0.3, caution: 0.3 }))).toBe(false)
    expect(shouldExplore(makeEmotionalState({ curiosity: 0.8, boredom: 0.7, caution: 0.9 }))).toBe(false)
  })
})

describe("generateInterests", () => {
  it("returns parsed interests from LLM", async () => {
    mockCallIntelligence.mockResolvedValue(
      ok({
        interests: [
          { topic: "Graph databases", reason: "Could improve memory associations", priority: 0.7 },
          { topic: "Music theory", reason: "Creative pattern recognition", priority: 0.5 }
        ]
      })
    )

    const result = await generateInterests(
      makeEmotionalState({ curiosity: 0.8 }),
      ["recent episode 1"],
      ["known topic 1"]
    )

    expect(result).toHaveLength(2)
    expect(result[0]?.topic).toBe("Graph databases")
  })
})

describe("createExplorationGoal", () => {
  beforeEach(() => {
    mockCreateGoal.mockResolvedValue(ok("goal-id"))
    mockStoreEpisode.mockResolvedValue("ep-id")
  })

  it("creates a goal with curiosity source", async () => {
    const id = await createExplorationGoal("Graph databases", "Better memory", 0.8)

    expect(id).toBe("goal-id")
    expect(mockCreateGoal).toHaveBeenCalledWith(
      "Explore: Graph databases",
      "Better memory",
      "curiosity",
      expect.closeTo(0.56),
      { emotionalWeight: 0.8 }
    )
  })

  it("stores an observation episode", async () => {
    await createExplorationGoal("Music theory", "Creative patterns")

    expect(mockStoreEpisode).toHaveBeenCalledWith(expect.stringContaining("Music theory"), "observation", {
      relevanceScore: 0.7
    })
  })
})
