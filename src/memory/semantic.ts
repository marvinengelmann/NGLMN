import { and, desc, eq, inArray, lt, or, type SQL } from "drizzle-orm"
import { env } from "@/infra/config/env.ts"
import { db } from "@/infra/db/client.ts"
import type { SemanticMemorySelect, SemanticRelationSelect } from "@/infra/db/schema.ts"
import { semanticMemory, semanticRelations } from "@/infra/db/schema.ts"
import { log } from "@/infra/lib/logger.ts"
import { shuffle } from "@/infra/lib/math.ts"
import type { AnimaResultAsync } from "@/infra/lib/result.ts"
import { trySafe } from "@/infra/lib/result.ts"
import { type RelationType, type SemanticCategory, SemanticScope, type SemanticSource } from "@/memory/types.ts"

/**
 * Get the operator's preferred language from environment config.
 */
export function getOperatorLanguage(): string {
  return env().OPERATOR_PREFERRED_LANGUAGE
}

/**
 * Store or update a piece of long-term knowledge (upsert on category+key+scope).
 */
export function storeKnowledge(
  category: SemanticCategory,
  key: string,
  value: unknown,
  source: SemanticSource,
  confidence: number = 0.5,
  scope: SemanticScope = SemanticScope.enum.self
): AnimaResultAsync<string> {
  return trySafe("DB_ERROR", async () => {
    const rows = await db
      .insert(semanticMemory)
      .values({ category, key, value, source, confidence, scope })
      .onConflictDoUpdate({
        target: [semanticMemory.category, semanticMemory.key, semanticMemory.scope],
        set: { value, source, confidence, updatedAt: new Date() }
      })
      .returning({ id: semanticMemory.id })

    const first = rows[0]
    if (!first) throw new Error("Expected row from semantic memory upsert")
    return first.id
  })
}

/**
 * Retrieve knowledge by category, key, and/or scope.
 * Also updates `lastAccessedAt` on returned rows.
 */
interface GetKnowledgeOptions {
  category?: SemanticCategory
  key?: string
  scope?: SemanticScope
  limit?: number
}

export function getKnowledge(options: GetKnowledgeOptions = {}): AnimaResultAsync<SemanticMemorySelect[]> {
  return trySafe("DB_ERROR", async () => {
    const conditions: SQL[] = []
    if (options.category) conditions.push(eq(semanticMemory.category, options.category))
    if (options.key) conditions.push(eq(semanticMemory.key, options.key))
    if (options.scope) conditions.push(eq(semanticMemory.scope, options.scope))

    let query = db
      .select()
      .from(semanticMemory)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(semanticMemory.updatedAt))
      .$dynamic()

    if (options.limit) {
      query = query.limit(options.limit)
    }

    const rows = await query

    if (rows.length > 0) {
      const ids = rows.map((r) => r.id)
      await db.update(semanticMemory).set({ lastAccessedAt: new Date() }).where(inArray(semanticMemory.id, ids))
    }

    return rows
  })
}

/**
 * Update the confidence score of a specific memory entry.
 */
export function updateConfidence(id: string, confidence: number): AnimaResultAsync<void> {
  return trySafe("DB_ERROR", async () => {
    await db.update(semanticMemory).set({ confidence, updatedAt: new Date() }).where(eq(semanticMemory.id, id))
  })
}

/**
 * Get the most recently accessed knowledge entries.
 */
export function getRecentlyAccessed(limit: number = 10): AnimaResultAsync<SemanticMemorySelect[]> {
  return trySafe("DB_ERROR", async () => {
    return db.select().from(semanticMemory).orderBy(desc(semanticMemory.lastAccessedAt)).limit(limit)
  })
}

/**
 * Store a relation between two semantic memory entities.
 */
export function storeRelation(
  sourceId: string,
  targetId: string,
  relationType: RelationType,
  description?: string,
  strength: number = 0.5
): AnimaResultAsync<string> {
  return trySafe("DB_ERROR", async () => {
    const rows = await db
      .insert(semanticRelations)
      .values({ sourceId, targetId, relationType, description, strength })
      .returning({ id: semanticRelations.id })

    const first = rows[0]
    if (!first) throw new Error("Expected row from semantic relation insert")
    return first.id
  })
}

/**
 * Get all relations for a given semantic memory entity.
 */
export function getRelationsFor(entityId: string): AnimaResultAsync<SemanticRelationSelect[]> {
  return trySafe("DB_ERROR", async () => {
    return db
      .select()
      .from(semanticRelations)
      .where(or(eq(semanticRelations.sourceId, entityId), eq(semanticRelations.targetId, entityId)))
      .orderBy(desc(semanticRelations.strength))
  })
}

/**
 * Get related entities via relations, optionally filtered by type.
 */
export function getRelatedEntities(
  entityId: string,
  relationType?: RelationType
): AnimaResultAsync<SemanticMemorySelect[]> {
  return trySafe("DB_ERROR", async () => {
    const conditions: (SQL | undefined)[] = [
      or(eq(semanticRelations.sourceId, entityId), eq(semanticRelations.targetId, entityId))
    ]
    if (relationType) {
      conditions.push(eq(semanticRelations.relationType, relationType))
    }

    const relations = await db
      .select()
      .from(semanticRelations)
      .where(and(...conditions))

    const relatedIds = relations.map((r) => (r.sourceId === entityId ? r.targetId : r.sourceId))

    if (relatedIds.length === 0) return []

    return db.select().from(semanticMemory).where(inArray(semanticMemory.id, relatedIds))
  })
}

/**
 * Subtly drift preference opinions over time — called during MAINTAIN with 5% probability.
 * Selects 1-2 random preference entries and slightly lowers their confidence.
 */
export function applyOpinionDrift(): AnimaResultAsync<void> {
  return trySafe("DB_ERROR", async () => {
    const preferences = await db
      .select()
      .from(semanticMemory)
      .where(and(eq(semanticMemory.category, "preference"), lt(semanticMemory.confidence, 0.7)))
      .orderBy(desc(semanticMemory.updatedAt))
      .limit(10)

    if (preferences.length === 0) return

    const count = Math.min(preferences.length, 1 + Math.floor(Math.random() * 2))
    const shuffled = shuffle(preferences).slice(0, count)

    await shuffled.reduce(async (prev, pref) => {
      await prev
      const drift = 0.05 + Math.random() * 0.05
      const newConfidence = Math.max(0.1, (pref.confidence ?? 0.5) - drift)
      await db
        .update(semanticMemory)
        .set({ confidence: newConfidence, updatedAt: new Date() })
        .where(eq(semanticMemory.id, pref.id))
      log.debug("Opinion drift applied", { key: pref.key, oldConfidence: pref.confidence, newConfidence })
    }, Promise.resolve())
  })
}
