import { afterEach, describe, expect, it, vi } from "vitest"
import { computeSemanticNovelty } from "./semantic.ts"

const { mockQuery, mockUpsert, mockInfo, mockDelete, mockRange } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockUpsert: vi.fn(),
  mockInfo: vi.fn(),
  mockDelete: vi.fn(),
  mockRange: vi.fn()
}))

vi.mock("@/infra/integrations/vector.ts", () => ({
  vectorIndex: {
    query: mockQuery,
    upsert: mockUpsert,
    info: mockInfo,
    delete: mockDelete,
    range: mockRange
  }
}))

afterEach(() => {
  vi.resetAllMocks()
})

describe("computeSemanticNovelty", () => {
  it("should return novelty 1.0 for completely new stimulus", async () => {
    mockQuery.mockResolvedValue([])
    mockInfo.mockResolvedValue({ namespaces: { habituation: { vectorCount: 10 } } })

    const result = await computeSemanticNovelty("I love cats")
    expect(result.level).toBe(1.0)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        data: "I love cats",
        metadata: expect.objectContaining({ exposureCount: 1 })
      }),
      { namespace: "habituation" }
    )
    expect(mockQuery).toHaveBeenCalledWith(expect.objectContaining({ data: "I love cats" }), {
      namespace: "habituation"
    })
  })

  it("should reduce novelty for semantically similar stimulus (score > 0.85)", async () => {
    mockQuery.mockResolvedValue([
      {
        id: "existing-id",
        score: 0.92,
        metadata: {
          exposureCount: 2,
          firstSeenAt: "2026-03-01T00:00:00Z",
          lastSeenAt: "2026-03-10T00:00:00Z"
        }
      }
    ])

    const result = await computeSemanticNovelty("Cats are my favorites")
    expect(result.level).toBeCloseTo(0.4)
    expect(result.id).toBe("existing-id")
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "existing-id",
        metadata: expect.objectContaining({ exposureCount: 3 })
      }),
      { namespace: "habituation" }
    )
  })

  it("should treat low similarity as novel", async () => {
    mockQuery
      .mockResolvedValueOnce([{ id: "some-id", score: 0.5, metadata: { exposureCount: 5 } }])
      .mockResolvedValueOnce([])
    mockInfo.mockResolvedValue({ namespaces: { habituation: { vectorCount: 10 } } })

    const result = await computeSemanticNovelty("Quantum physics is fascinating")
    expect(result.level).toBe(1.0)
  })

  it("should habituate to zero after 5+ exposures", async () => {
    mockQuery.mockResolvedValue([
      {
        id: "id",
        score: 0.95,
        metadata: { exposureCount: 5, firstSeenAt: "2026-01-01T00:00:00Z", lastSeenAt: "2026-03-10T00:00:00Z" }
      }
    ])

    const result = await computeSemanticNovelty("same topic again")
    expect(result.level).toBe(0)
  })

  it("should trigger eviction when too many entries", async () => {
    mockQuery.mockResolvedValueOnce([])
    mockInfo.mockResolvedValue({ namespaces: { habituation: { vectorCount: 210 } } })
    mockRange.mockResolvedValueOnce({
      nextCursor: "0",
      vectors: Array.from({ length: 210 }, (_, i) => ({
        id: `old-${i}`,
        metadata: {
          firstSeenAt: new Date(2025, 0, (i % 28) + 1).toISOString(),
          lastSeenAt: new Date(2025, 0, (i % 28) + 1).toISOString(),
          exposureCount: 1
        }
      }))
    })

    await computeSemanticNovelty("trigger eviction")
    expect(mockRange).toHaveBeenCalledWith(expect.objectContaining({ cursor: 0, limit: 100, includeMetadata: true }), {
      namespace: "habituation"
    })
    expect(mockDelete).toHaveBeenCalledWith(expect.any(Array), { namespace: "habituation" })
  })
})
