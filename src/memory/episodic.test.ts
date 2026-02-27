vi.mock("@/integrations/vector.ts", () => ({
  vectorIndex: {
    upsert: vi.fn(),
    query: vi.fn(),
    update: vi.fn()
  }
}))

vi.mock("@/core/intelligence.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/core/intelligence.ts")>()),
  callIntelligence: vi.fn()
}))

vi.mock("@/lib/logger.ts", () => ({
  log: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() }
}))

import { formatISO, subDays } from "date-fns"
import { err, ok } from "neverthrow"
import { callIntelligence } from "@/core/intelligence.ts"
import { vectorIndex } from "@/integrations/vector.ts"
import { log } from "@/lib/logger.ts"
import type { EpisodeMetadata } from "@/memory/types.ts"
import {
  downgradeEpisodes,
  getRecentByCategory,
  queryRelated,
  storeEpisode,
  storeRelationshipEpisode,
  summarizeOldEpisodes
} from "./episodic.ts"

const mockVector = vi.mocked(vectorIndex)
const mockCallIntelligence = vi.mocked(callIntelligence)
const mockLog = vi.mocked(log)

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal(
    "crypto",
    Object.assign({}, crypto, {
      randomUUID: vi.fn().mockReturnValue("test-uuid-1234")
    })
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("storeEpisode", () => {
  it("stores episode with correct metadata and auto-generated ID", async () => {
    mockVector.upsert.mockResolvedValue("Success")

    const id = await storeEpisode("User asked about weather", "interaction", {
      relevanceScore: 0.8,
      emotionalState: "curious",
      tickId: "tick-001"
    })

    expect(id).toBe("test-uuid-1234")
    expect(mockVector.upsert).toHaveBeenCalledWith({
      id: "test-uuid-1234",
      data: "User asked about weather",
      metadata: {
        category: "interaction",
        timestamp: expect.any(String),
        relevanceScore: 0.8,
        emotionalState: "curious",
        tickId: "tick-001"
      }
    })
  })

  it("uses default relevance score of 0.5 when not provided", async () => {
    mockVector.upsert.mockResolvedValue("Success")

    await storeEpisode("Something happened", "observation")

    expect(mockVector.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          relevanceScore: 0.5
        })
      })
    )
  })

  it("handles undefined optional metadata fields", async () => {
    mockVector.upsert.mockResolvedValue("Success")

    await storeEpisode("Dream episode", "dream", {})

    expect(mockVector.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          emotionalState: undefined,
          tickId: undefined
        })
      })
    )
  })
})

describe("queryRelated", () => {
  it("queries vector index with correct parameters", async () => {
    const mockResults = [
      { id: "ep-1", score: 0.95, metadata: { category: "interaction", timestamp: "2026-01-01", relevanceScore: 0.8 } },
      { id: "ep-2", score: 0.8, metadata: { category: "task", timestamp: "2026-01-02", relevanceScore: 0.6 } }
    ]
    mockVector.query.mockResolvedValue(mockResults as never)

    const results = await queryRelated("weather patterns", 3)

    expect(mockVector.query).toHaveBeenCalledWith({
      data: "weather patterns",
      topK: 3,
      includeMetadata: true
    })
    expect(results).toHaveLength(2)
    expect(results[0]?.id).toBe("ep-1")
    expect(results[0]?.score).toBe(0.95)
  })

  it("uses default topK of 5", async () => {
    mockVector.query.mockResolvedValue([])

    await queryRelated("test query")

    expect(mockVector.query).toHaveBeenCalledWith(expect.objectContaining({ topK: 5 }))
  })

  it("passes filter when provided", async () => {
    mockVector.query.mockResolvedValue([])

    await queryRelated("test", 5, "category = 'interaction'")

    expect(mockVector.query).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: "category = 'interaction'"
      })
    )
  })

  it("does not include filter when not provided", async () => {
    mockVector.query.mockResolvedValue([])

    await queryRelated("test")

    const callArg = mockVector.query.mock.calls[0]?.[0]
    expect(callArg).not.toHaveProperty("filter")
  })
})

describe("storeRelationshipEpisode", () => {
  it("stores with relationship category and high relevance", async () => {
    mockVector.upsert.mockResolvedValue("Success")

    const id = await storeRelationshipEpisode("Operator shared personal story", {
      emotionalState: "connected",
      tickId: "tick-005"
    })

    expect(id).toBe("test-uuid-1234")
    expect(mockVector.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          category: "relationship",
          relevanceScore: 0.85,
          emotionalState: "connected",
          tickId: "tick-005"
        })
      })
    )
  })

  it("defaults to relevance 0.85 even without other metadata", async () => {
    mockVector.upsert.mockResolvedValue("Success")

    await storeRelationshipEpisode("Simple relationship episode")

    expect(mockVector.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          relevanceScore: 0.85
        })
      })
    )
  })
})

describe("downgradeEpisodes", () => {
  it("updates each episode with the downgrade factor", async () => {
    mockVector.update.mockResolvedValue(undefined as never)

    const count = await downgradeEpisodes(["id-1", "id-2", "id-3"], 0.3)

    expect(count).toBe(3)
    expect(mockVector.update).toHaveBeenCalledTimes(3)
    expect(mockVector.update).toHaveBeenCalledWith({
      id: "id-1",
      metadata: { relevanceScore: 0.3 },
      metadataUpdateMode: "PATCH"
    })
  })

  it("uses default factor of 0.5", async () => {
    mockVector.update.mockResolvedValue(undefined as never)

    await downgradeEpisodes(["id-1"])

    expect(mockVector.update).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { relevanceScore: 0.5 }
      })
    )
  })

  it("handles individual failures gracefully and continues", async () => {
    mockVector.update
      .mockResolvedValueOnce(undefined as never)
      .mockRejectedValueOnce(new Error("Vector DB error"))
      .mockResolvedValueOnce(undefined as never)

    const count = await downgradeEpisodes(["id-1", "id-2", "id-3"])

    expect(count).toBe(2)
    expect(mockLog.warn).toHaveBeenCalledWith("Failed to downgrade episode", {
      id: "id-2",
      error: "Error: Vector DB error"
    })
  })

  it("returns 0 for empty ID list", async () => {
    const count = await downgradeEpisodes([])

    expect(count).toBe(0)
    expect(mockVector.update).not.toHaveBeenCalled()
  })
})

describe("summarizeOldEpisodes", () => {
  const oldTimestamp = formatISO(subDays(new Date(), 10))

  function makeOldEpisode(id: string, category: string, relevanceScore: number = 0.3) {
    return {
      id,
      score: 0.5,
      data: `Episode content for ${id}`,
      metadata: {
        category,
        timestamp: oldTimestamp,
        relevanceScore
      } as EpisodeMetadata
    }
  }

  it("summarizes old low-relevance episodes and creates summary episodes", async () => {
    const episodes = [
      makeOldEpisode("ep-1", "interaction"),
      makeOldEpisode("ep-2", "interaction"),
      makeOldEpisode("ep-3", "interaction")
    ]

    mockVector.query.mockResolvedValue(episodes as never)
    mockCallIntelligence.mockReturnValue(ok({ text: "Summarized: User had three interactions." }) as never)
    mockVector.upsert.mockResolvedValue("Success")
    mockVector.update.mockResolvedValue(undefined as never)

    const result = await summarizeOldEpisodes(7)

    expect(result.created).toBeGreaterThanOrEqual(1)
    expect(result.summarized).toBeGreaterThanOrEqual(3)
    expect(mockCallIntelligence).toHaveBeenCalled()
    expect(mockVector.upsert).toHaveBeenCalled()
  })

  it("skips categories with fewer than 3 eligible episodes", async () => {
    const episodes = [makeOldEpisode("ep-1", "interaction"), makeOldEpisode("ep-2", "interaction")]

    mockVector.query.mockResolvedValue(episodes as never)

    const result = await summarizeOldEpisodes(7)

    expect(result.created).toBe(0)
    expect(result.summarized).toBe(0)
    expect(mockCallIntelligence).not.toHaveBeenCalled()
  })

  it("skips episodes with high relevance scores", async () => {
    const episodes = [
      makeOldEpisode("ep-1", "interaction", 0.8),
      makeOldEpisode("ep-2", "interaction", 0.9),
      makeOldEpisode("ep-3", "interaction", 0.7)
    ]

    mockVector.query.mockResolvedValue(episodes as never)

    const result = await summarizeOldEpisodes(7)

    expect(result.created).toBe(0)
    expect(result.summarized).toBe(0)
  })

  it("skips episodes that are too recent", async () => {
    const recentTimestamp = formatISO(new Date())
    const episodes = [
      {
        id: "ep-1",
        score: 0.5,
        data: "recent",
        metadata: { category: "interaction", timestamp: recentTimestamp, relevanceScore: 0.3 }
      },
      {
        id: "ep-2",
        score: 0.5,
        data: "recent",
        metadata: { category: "interaction", timestamp: recentTimestamp, relevanceScore: 0.3 }
      },
      {
        id: "ep-3",
        score: 0.5,
        data: "recent",
        metadata: { category: "interaction", timestamp: recentTimestamp, relevanceScore: 0.3 }
      }
    ]

    mockVector.query.mockResolvedValue(episodes as never)

    const result = await summarizeOldEpisodes(7)

    expect(result.created).toBe(0)
    expect(result.summarized).toBe(0)
  })

  it("continues when LLM summarization fails", async () => {
    const interactionEps = [
      makeOldEpisode("ep-1", "interaction"),
      makeOldEpisode("ep-2", "interaction"),
      makeOldEpisode("ep-3", "interaction")
    ]

    mockVector.query.mockResolvedValue(interactionEps as never)
    mockCallIntelligence.mockReturnValue(err({ tag: "LLM_ERROR", message: "Rate limited" }) as never)

    const result = await summarizeOldEpisodes(7)

    expect(result.created).toBe(0)
    expect(result.summarized).toBe(0)
  })

  it("handles episodes with invalid timestamps gracefully", async () => {
    const episodes = [
      {
        id: "ep-1",
        score: 0.5,
        data: "data",
        metadata: { category: "interaction", timestamp: "not-a-date", relevanceScore: 0.3 }
      },
      {
        id: "ep-2",
        score: 0.5,
        data: "data",
        metadata: { category: "interaction", timestamp: "also-not-a-date", relevanceScore: 0.3 }
      },
      {
        id: "ep-3",
        score: 0.5,
        data: "data",
        metadata: { category: "interaction", timestamp: "invalid", relevanceScore: 0.3 }
      }
    ]

    mockVector.query.mockResolvedValue(episodes as never)

    const result = await summarizeOldEpisodes(7)

    expect(result.created).toBe(0)
    expect(result.summarized).toBe(0)
  })
})

describe("getRecentByCategory", () => {
  it("queries with correct category filter and limit", async () => {
    const mockResults = [
      { id: "ep-1", score: 0.9, metadata: { category: "task", timestamp: "2026-01-01", relevanceScore: 0.7 } }
    ]
    mockVector.query.mockResolvedValue(mockResults as never)

    const results = await getRecentByCategory("task", 3)

    expect(mockVector.query).toHaveBeenCalledWith({
      data: "recent task activity",
      topK: 3,
      includeMetadata: true,
      filter: "category = 'task'"
    })
    expect(results).toHaveLength(1)
    expect(results[0]?.id).toBe("ep-1")
  })

  it("uses default limit of 5", async () => {
    mockVector.query.mockResolvedValue([])

    await getRecentByCategory("observation")

    expect(mockVector.query).toHaveBeenCalledWith(expect.objectContaining({ topK: 5 }))
  })

  it("returns mapped results with id, score, and metadata", async () => {
    const meta: EpisodeMetadata = {
      category: "dream",
      timestamp: "2026-02-20T00:00:00Z",
      relevanceScore: 0.6
    }
    mockVector.query.mockResolvedValue([{ id: "dream-1", score: 0.88, metadata: meta }] as never)

    const results = await getRecentByCategory("dream")

    expect(results[0]).toEqual({
      id: "dream-1",
      score: 0.88,
      metadata: meta
    })
  })
})
