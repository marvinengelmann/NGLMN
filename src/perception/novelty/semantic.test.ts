import { afterEach, describe, expect, it, vi } from "vitest"
import { computeSemanticNovelty } from "./semantic.ts"

const mockQuery = vi.fn()
const mockUpsert = vi.fn()
const mockInfo = vi.fn()
const mockDelete = vi.fn()
const mockRange = vi.fn()

vi.mock("./vector.ts", () => ({
  getHabituationIndex: () => ({
    query: mockQuery,
    upsert: mockUpsert,
    info: mockInfo,
    delete: mockDelete,
    range: mockRange
  })
}))

afterEach(() => {
  vi.resetAllMocks()
})

describe("computeSemanticNovelty", () => {
  it("should return novelty 1.0 for completely new stimulus", async () => {
    mockQuery.mockResolvedValue([])
    mockInfo.mockResolvedValue({ vectorCount: 10 })

    const result = await computeSemanticNovelty("I love cats")
    expect(result).not.toBeNull()
    expect(result?.level).toBe(1.0)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        data: "I love cats",
        metadata: expect.objectContaining({ exposureCount: 1 })
      })
    )
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
    expect(result).not.toBeNull()
    expect(result?.level).toBeCloseTo(0.4)
    expect(result?.id).toBe("existing-id")
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "existing-id",
        metadata: expect.objectContaining({ exposureCount: 3 })
      })
    )
  })

  it("should treat low similarity as novel", async () => {
    mockQuery
      .mockResolvedValueOnce([{ id: "some-id", score: 0.5, metadata: { exposureCount: 5 } }])
      .mockResolvedValueOnce([])
    mockInfo.mockResolvedValue({ vectorCount: 10 })

    const result = await computeSemanticNovelty("Quantum physics is fascinating")
    expect(result).not.toBeNull()
    expect(result?.level).toBe(1.0)
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
    expect(result).not.toBeNull()
    expect(result?.level).toBe(0)
  })

  it("should trigger eviction when too many entries", async () => {
    mockQuery.mockResolvedValueOnce([])
    mockInfo.mockResolvedValue({ vectorCount: 210 })
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
    expect(mockRange).toHaveBeenCalled()
    expect(mockDelete).toHaveBeenCalled()
  })
})
