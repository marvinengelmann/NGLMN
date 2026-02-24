vi.mock("@/db/client.ts", () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain.insert = vi.fn().mockReturnValue(chain)
  chain.select = vi.fn().mockReturnValue(chain)
  chain.update = vi.fn().mockReturnValue(chain)
  chain.delete = vi.fn().mockReturnValue(chain)
  chain.from = vi.fn().mockReturnValue(chain)
  chain.set = vi.fn().mockReturnValue(chain)
  chain.values = vi.fn().mockReturnValue(chain)
  chain.onConflictDoUpdate = vi.fn().mockReturnValue(chain)
  chain.where = vi.fn().mockReturnValue(chain)
  chain.orderBy = vi.fn().mockReturnValue(chain)
  chain.limit = vi.fn().mockReturnValue(chain)
  chain.returning = vi.fn()
  chain.transaction = vi.fn().mockImplementation((fn: (tx: typeof chain) => Promise<unknown>) => fn(chain))
  return { db: chain }
})

vi.mock("@/db/schema.ts", () => ({
  semanticMemory: {
    id: "id",
    category: "category",
    key: "key",
    value: "value",
    confidence: "confidence",
    source: "source",
    createdAt: "created_at",
    updatedAt: "updated_at",
    lastAccessedAt: "last_accessed_at"
  },
  semanticRelations: {
    id: "id",
    sourceId: "source_id",
    targetId: "target_id",
    relationType: "relation_type",
    strength: "strength",
    description: "description",
    createdAt: "created_at",
    updatedAt: "updated_at"
  }
}))

vi.mock("@/lib/logger.ts", () => ({
  log: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() }
}))

vi.mock("@/lib/sentry.ts", () => ({
  captureError: vi.fn()
}))

import { db } from "@/db/client.ts"
import type { MockDbChain } from "@/test/mocks.ts"
import {
  getKnowledge,
  getRecentlyAccessed,
  getRelatedEntities,
  getRelationsFor,
  storeKnowledge,
  storeRelation,
  updateConfidence
} from "./semantic.ts"

const mockDb = db as unknown as MockDbChain

beforeEach(() => {
  vi.clearAllMocks()
  for (const method of [
    "insert",
    "select",
    "update",
    "delete",
    "from",
    "set",
    "values",
    "onConflictDoUpdate",
    "where",
    "orderBy",
    "limit"
  ] as const) {
    mockDb[method].mockReturnValue(mockDb as never)
  }
})

describe("storeKnowledge", () => {
  it("returns ok with the new entry ID on success", async () => {
    mockDb.returning.mockResolvedValue([{ id: "sem-uuid-1" }])

    const result = await storeKnowledge("preference", "color", "blue", "operator", 0.9)

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBe("sem-uuid-1")
    expect(mockDb.insert).toHaveBeenCalled()
    expect(mockDb.values).toHaveBeenCalledWith({
      category: "preference",
      key: "color",
      value: "blue",
      source: "operator",
      confidence: 0.9
    })
  })

  it("uses default confidence of 0.5", async () => {
    mockDb.returning.mockResolvedValue([{ id: "sem-uuid-2" }])

    await storeKnowledge("knowledge", "fact", "Earth is round", "observation")

    expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({ confidence: 0.5 }))
  })

  it("returns err when insert returns empty array", async () => {
    mockDb.returning.mockResolvedValue([])

    const result = await storeKnowledge("preference", "key", "val", "operator")

    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe("DB_ERROR")
  })

  it("returns err when database throws", async () => {
    mockDb.returning.mockRejectedValue(new Error("DB connection failed"))

    const result = await storeKnowledge("preference", "key", "val", "operator")

    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe("DB_ERROR")
    expect(result._unsafeUnwrapErr().message).toBe("DB connection failed")
  })
})

describe("getKnowledge", () => {
  it("returns rows filtered by category", async () => {
    const rows = [{ id: "1", category: "preference", key: "color", value: "blue", confidence: 0.8, source: "operator" }]
    mockDb.orderBy.mockResolvedValue(rows)
    mockDb.where.mockReturnValue(mockDb as never)

    const result = await getKnowledge("preference")

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual(rows)
    expect(mockDb.select).toHaveBeenCalled()
    expect(mockDb.where).toHaveBeenCalled()
  })

  it("returns rows filtered by key", async () => {
    const rows = [{ id: "2", category: "knowledge", key: "planet", value: "Earth" }]
    mockDb.orderBy.mockResolvedValue(rows)

    const result = await getKnowledge(undefined, "planet")

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual(rows)
  })

  it("returns all rows when no filters", async () => {
    const rows = [{ id: "3" }, { id: "4" }]
    mockDb.orderBy.mockResolvedValue(rows)

    const result = await getKnowledge()

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toHaveLength(2)
  })

  it("updates lastAccessedAt for returned rows", async () => {
    const rows = [{ id: "5", category: "preference", key: "theme", value: "dark" }]
    mockDb.orderBy.mockResolvedValue(rows)
    mockDb.where.mockReturnValue(mockDb as never)

    await getKnowledge("preference", "theme")

    expect(mockDb.update).toHaveBeenCalled()
    expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({ lastAccessedAt: expect.any(Date) }))
  })

  it("does not update lastAccessedAt when no rows returned", async () => {
    mockDb.orderBy.mockResolvedValue([])

    await getKnowledge("preference")

    expect(mockDb.update).not.toHaveBeenCalled()
  })

  it("returns err when database throws", async () => {
    mockDb.orderBy.mockRejectedValue(new Error("DB down"))

    const result = await getKnowledge()

    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe("DB_ERROR")
  })
})

describe("updateConfidence", () => {
  it("updates confidence and updatedAt for the given ID", async () => {
    mockDb.where.mockResolvedValue(undefined)

    const result = await updateConfidence("sem-uuid-1", 0.95)

    expect(result.isOk()).toBe(true)
    expect(mockDb.update).toHaveBeenCalled()
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        confidence: 0.95,
        updatedAt: expect.any(Date)
      })
    )
    expect(mockDb.where).toHaveBeenCalled()
  })

  it("returns err when database throws", async () => {
    mockDb.where.mockRejectedValue(new Error("Update failed"))

    const result = await updateConfidence("sem-uuid-1", 0.95)

    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe("DB_ERROR")
  })
})

describe("getRecentlyAccessed", () => {
  it("returns entries ordered by lastAccessedAt with limit", async () => {
    const rows = [{ id: "r1" }, { id: "r2" }]
    mockDb.limit.mockResolvedValue(rows)

    const result = await getRecentlyAccessed(5)

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual(rows)
    expect(mockDb.select).toHaveBeenCalled()
    expect(mockDb.orderBy).toHaveBeenCalled()
    expect(mockDb.limit).toHaveBeenCalledWith(5)
  })

  it("uses default limit of 10", async () => {
    mockDb.limit.mockResolvedValue([])

    await getRecentlyAccessed()

    expect(mockDb.limit).toHaveBeenCalledWith(10)
  })

  it("returns err when database throws", async () => {
    mockDb.limit.mockRejectedValue(new Error("DB down"))

    const result = await getRecentlyAccessed()

    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe("DB_ERROR")
  })
})

describe("storeRelation", () => {
  it("returns ok with the new relation ID on success", async () => {
    mockDb.returning.mockResolvedValue([{ id: "rel-uuid-1" }])

    const result = await storeRelation("src-id", "tgt-id", "related_to", "They are related", 0.7)

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBe("rel-uuid-1")
    expect(mockDb.values).toHaveBeenCalledWith({
      sourceId: "src-id",
      targetId: "tgt-id",
      relationType: "related_to",
      description: "They are related",
      strength: 0.7
    })
  })

  it("uses default strength of 0.5", async () => {
    mockDb.returning.mockResolvedValue([{ id: "rel-uuid-2" }])

    await storeRelation("src-id", "tgt-id", "uses")

    expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({ strength: 0.5 }))
  })

  it("returns err when insert returns empty array", async () => {
    mockDb.returning.mockResolvedValue([])

    const result = await storeRelation("src-id", "tgt-id", "part_of")

    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe("DB_ERROR")
  })

  it("returns err when database throws", async () => {
    mockDb.returning.mockRejectedValue(new Error("Constraint violation"))

    const result = await storeRelation("src-id", "tgt-id", "depends_on")

    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toBe("Constraint violation")
  })
})

describe("getRelationsFor", () => {
  it("returns relations for an entity sorted by strength", async () => {
    const relations = [
      { id: "r1", sourceId: "entity-1", targetId: "entity-2", relationType: "related_to", strength: 0.9 },
      { id: "r2", sourceId: "entity-3", targetId: "entity-1", relationType: "uses", strength: 0.5 }
    ]
    mockDb.orderBy.mockResolvedValue(relations)

    const result = await getRelationsFor("entity-1")

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual(relations)
    expect(mockDb.select).toHaveBeenCalled()
    expect(mockDb.where).toHaveBeenCalled()
    expect(mockDb.orderBy).toHaveBeenCalled()
  })

  it("returns err when database throws", async () => {
    mockDb.orderBy.mockRejectedValue(new Error("DB down"))

    const result = await getRelationsFor("entity-1")

    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe("DB_ERROR")
  })
})

describe("getRelatedEntities", () => {
  it("returns related entities via relations", async () => {
    const relations = [
      { id: "r1", sourceId: "entity-1", targetId: "entity-2", relationType: "related_to", strength: 0.8 }
    ]
    const entities = [{ id: "entity-2", category: "knowledge", key: "topic", value: "AI" }]

    mockDb.where.mockResolvedValueOnce(relations).mockResolvedValueOnce(entities)

    const result = await getRelatedEntities("entity-1")

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual(entities)
    expect(mockDb.select).toHaveBeenCalledTimes(2)
  })

  it("returns empty array when no relations exist", async () => {
    mockDb.where.mockResolvedValueOnce([])

    const result = await getRelatedEntities("lonely-entity")

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual([])
    expect(mockDb.select).toHaveBeenCalledTimes(1)
  })

  it("applies relation type filter when provided", async () => {
    const relations = [{ id: "r1", sourceId: "entity-1", targetId: "entity-2", relationType: "uses", strength: 0.6 }]
    const entities = [{ id: "entity-2" }]

    mockDb.where.mockResolvedValueOnce(relations).mockResolvedValueOnce(entities)

    const result = await getRelatedEntities("entity-1", "uses")

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual(entities)
  })

  it("correctly resolves targetId when entity is the source", async () => {
    const relations = [{ id: "r1", sourceId: "me", targetId: "other", relationType: "related_to", strength: 0.5 }]
    const entities = [{ id: "other" }]

    mockDb.where.mockResolvedValueOnce(relations).mockResolvedValueOnce(entities)

    const result = await getRelatedEntities("me")

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual(entities)
  })

  it("correctly resolves sourceId when entity is the target", async () => {
    const relations = [{ id: "r1", sourceId: "other", targetId: "me", relationType: "part_of", strength: 0.7 }]
    const entities = [{ id: "other" }]

    mockDb.where.mockResolvedValueOnce(relations).mockResolvedValueOnce(entities)

    const result = await getRelatedEntities("me")

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual(entities)
  })

  it("returns err when database throws", async () => {
    mockDb.where.mockRejectedValue(new Error("DB down"))

    const result = await getRelatedEntities("entity-1")

    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe("DB_ERROR")
  })
})
