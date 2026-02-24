vi.mock("@/integrations/anthropic.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/integrations/anthropic.ts")>()),
  callClaude: vi.fn()
}))

vi.mock("@/memory/episodic.ts", () => ({
  queryRelated: vi.fn(),
  downgradeEpisodes: vi.fn(),
  summarizeOldEpisodes: vi.fn().mockResolvedValue({ summarized: 0, created: 0 })
}))

vi.mock("@/memory/semantic.ts", async () => {
  const z = await import("zod")
  return {
    storeKnowledge: vi.fn(),
    storeRelation: vi.fn(),
    RelationType: z.enum(["related_to", "part_of", "created_by", "uses", "depends_on", "similar_to", "contradicts"])
  }
})

import { ok } from "neverthrow"
import { callClaude } from "@/integrations/anthropic.ts"
import { downgradeEpisodes, queryRelated } from "@/memory/episodic.ts"
import { storeKnowledge, storeRelation } from "@/memory/semantic.ts"
import { consolidateMemories } from "./consolidation.ts"

const mockCallClaude = callClaude as ReturnType<typeof vi.fn>
const mockQueryRelated = queryRelated as ReturnType<typeof vi.fn>
const mockStoreKnowledge = storeKnowledge as ReturnType<typeof vi.fn>
const mockStoreRelation = storeRelation as ReturnType<typeof vi.fn>
const mockDowngradeEpisodes = downgradeEpisodes as ReturnType<typeof vi.fn>

describe("consolidateMemories", () => {
  beforeEach(() => {
    mockStoreKnowledge.mockResolvedValue(ok("sem-default"))
    mockStoreRelation.mockResolvedValue(ok("rel-default"))
  })

  it("returns zeros when no episodes found", async () => {
    mockQueryRelated.mockResolvedValue([])
    const result = await consolidateMemories()
    expect(result.episodesProcessed).toBe(0)
    expect(result.semanticEntriesCreated).toBe(0)
    expect(result.connectionsFound).toBe(0)
    expect(result.downgraded).toBe(0)
    expect(mockCallClaude).not.toHaveBeenCalled()
  })

  it("processes episodes and stores semantic knowledge", async () => {
    mockQueryRelated.mockResolvedValue([
      { id: "ep-1", score: 0.9, metadata: { category: "interaction", timestamp: "2025-01-01" } },
      { id: "ep-2", score: 0.8, metadata: { category: "task", timestamp: "2025-01-01" } }
    ])

    mockCallClaude.mockResolvedValue(
      ok(
        JSON.stringify({
          semanticEntries: [
            { category: "insight", key: "pattern-1", value: "Operator prefers morning updates", confidence: 0.8 }
          ],
          connections: [
            { episodeIds: ["ep-1", "ep-2"], connectionType: "thematic", description: "both relate to communication" }
          ],
          downgradeIds: []
        })
      )
    )

    mockStoreKnowledge.mockResolvedValue(ok("sem-1"))

    const result = await consolidateMemories()
    expect(result.episodesProcessed).toBe(2)
    expect(result.semanticEntriesCreated).toBe(1)
    expect(result.connectionsFound).toBe(1)
    expect(result.downgraded).toBe(0)
    expect(mockStoreKnowledge).toHaveBeenCalledWith(
      "insight",
      "pattern-1",
      "Operator prefers morning updates",
      "dream",
      0.8
    )
  })

  it("deduplicates episodes across queries", async () => {
    mockQueryRelated.mockResolvedValue([
      { id: "ep-1", score: 0.9, metadata: { category: "interaction", timestamp: "2025-01-01" } }
    ])

    mockCallClaude.mockResolvedValue(
      ok(
        JSON.stringify({
          semanticEntries: [],
          connections: [],
          downgradeIds: []
        })
      )
    )

    const result = await consolidateMemories()
    expect(result.episodesProcessed).toBe(1)
  })

  it("downgrades episodes when downgradeIds are returned", async () => {
    mockQueryRelated.mockResolvedValue([
      { id: "ep-1", score: 0.9, metadata: { category: "interaction", timestamp: "2025-01-01" } }
    ])

    mockCallClaude.mockResolvedValue(
      ok(
        JSON.stringify({
          semanticEntries: [],
          connections: [],
          downgradeIds: ["ep-1", "ep-old"]
        })
      )
    )

    mockDowngradeEpisodes.mockResolvedValue(2)

    const result = await consolidateMemories()
    expect(result.downgraded).toBe(2)
    expect(mockDowngradeEpisodes).toHaveBeenCalledWith(["ep-1", "ep-old"])
  })

  it("falls back to 'knowledge' for invalid categories", async () => {
    mockQueryRelated.mockResolvedValue([
      { id: "ep-1", score: 0.9, metadata: { category: "interaction", timestamp: "2025-01-01" } }
    ])

    mockCallClaude.mockResolvedValue(
      ok(
        JSON.stringify({
          semanticEntries: [{ category: "invalid_category", key: "test", value: "val", confidence: 0.5 }],
          connections: [],
          downgradeIds: []
        })
      )
    )

    mockStoreKnowledge.mockResolvedValue(ok("sem-1"))

    await consolidateMemories()
    expect(mockStoreKnowledge).toHaveBeenCalledWith("knowledge", "test", "val", "dream", 0.5)
  })
})
