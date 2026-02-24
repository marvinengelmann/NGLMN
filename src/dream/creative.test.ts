vi.mock("@/integrations/anthropic.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/integrations/anthropic.ts")>()),
  callClaude: vi.fn()
}))

vi.mock("@/memory/episodic.ts", () => ({
  queryRelated: vi.fn(),
  storeEpisode: vi.fn()
}))

vi.mock("@/memory/semantic.ts", () => ({
  getKnowledge: vi.fn(),
  storeKnowledge: vi.fn()
}))

vi.mock("@/memory/goals.ts", () => ({
  createGoal: vi.fn()
}))

import { ok } from "neverthrow"
import { callClaude } from "@/integrations/anthropic.ts"
import { queryRelated, storeEpisode } from "@/memory/episodic.ts"
import { createGoal } from "@/memory/goals.ts"
import { getKnowledge, storeKnowledge } from "@/memory/semantic.ts"
import { findCreativeConnections } from "./creative.ts"

const mockCallClaude = callClaude as ReturnType<typeof vi.fn>
const mockQueryRelated = queryRelated as ReturnType<typeof vi.fn>
const mockStoreEpisode = storeEpisode as ReturnType<typeof vi.fn>
const mockGetKnowledge = getKnowledge as ReturnType<typeof vi.fn>
const mockStoreKnowledge = storeKnowledge as ReturnType<typeof vi.fn>
const mockCreateGoal = createGoal as ReturnType<typeof vi.fn>

describe("findCreativeConnections", () => {
  beforeEach(() => {
    mockGetKnowledge.mockResolvedValue(ok([]))
    mockStoreEpisode.mockResolvedValue("ep-new")
    mockStoreKnowledge.mockResolvedValue(ok("sem-new"))
    mockCreateGoal.mockResolvedValue(ok("goal-new"))
  })

  it("returns zeros when no data found", async () => {
    mockQueryRelated.mockResolvedValue([])
    const result = await findCreativeConnections()
    expect(result).toEqual({ connectionsFound: 0, goalsCreated: 0, insightsStored: 0 })
    expect(mockCallClaude).not.toHaveBeenCalled()
  })

  it("processes episodes and stores high-confidence connections", async () => {
    mockQueryRelated.mockResolvedValue([{ id: "ep-1", score: 0.9, metadata: { category: "interaction" } }])

    mockCallClaude.mockResolvedValue(
      ok(
        JSON.stringify({
          connections: [
            {
              sources: ["episode 1", "knowledge 1"],
              insight: "Interesting pattern found",
              confidence: 0.8,
              actionable: false,
              suggestedGoal: null
            }
          ]
        })
      )
    )

    const result = await findCreativeConnections()
    expect(result.connectionsFound).toBe(1)
    expect(result.insightsStored).toBe(1)
    expect(mockStoreEpisode).toHaveBeenCalledWith("Dream connection: Interesting pattern found", "dream", {
      relevanceScore: 0.8
    })
  })

  it("creates goals for actionable connections", async () => {
    mockQueryRelated.mockResolvedValue([{ id: "ep-1", score: 0.9, metadata: { category: "task" } }])

    mockCallClaude.mockResolvedValue(
      ok(
        JSON.stringify({
          connections: [
            {
              sources: ["source1"],
              insight: "Should explore X",
              confidence: 0.7,
              actionable: true,
              suggestedGoal: "Explore topic X"
            }
          ]
        })
      )
    )

    const result = await findCreativeConnections()
    expect(result.goalsCreated).toBe(1)
    expect(mockCreateGoal).toHaveBeenCalledWith(
      "Explore topic X",
      "Creative dream connection: Should explore X",
      "dream",
      0.35,
      { emotionalWeight: 0.7 }
    )
  })

  it("skips low-confidence connections for storage", async () => {
    mockQueryRelated.mockResolvedValue([{ id: "ep-1", score: 0.5, metadata: { category: "observation" } }])

    mockCallClaude.mockResolvedValue(
      ok(
        JSON.stringify({
          connections: [
            {
              sources: ["s1"],
              insight: "Weak connection",
              confidence: 0.3,
              actionable: false,
              suggestedGoal: null
            }
          ]
        })
      )
    )

    const result = await findCreativeConnections()
    expect(result.connectionsFound).toBe(1)
    expect(result.insightsStored).toBe(0)
    expect(mockStoreEpisode).not.toHaveBeenCalled()
  })
})
