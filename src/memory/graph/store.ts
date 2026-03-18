import { and, desc, eq, gt, sql } from "drizzle-orm"
import { db } from "@/infra/db/client.ts"
import type { EntityInsert, EntityRelationInsert, EntitySelect } from "@/infra/db/schema.ts"
import { entities, entityMentions, entityRelations } from "@/infra/db/schema.ts"
import type { AnimaResultAsync } from "@/infra/lib/result.ts"
import { trySafe } from "@/infra/lib/result.ts"
import type { EntityType } from "./types.ts"
import { GRAPH_CONSTANTS } from "./types.ts"

/**
 * Insert or update an entity by case-insensitive exact name match.
 * If a match exists: update lastMentionedAt, increment mentionCount, merge attributes.
 * Otherwise: insert a new entity.
 */
export function upsertEntity(
  name: string,
  type: EntityType,
  attributes: Record<string, unknown>,
  source: EntityInsert["source"]
): AnimaResultAsync<string> {
  return trySafe("GRAPH_ERROR", async () => {
    const existing = await db.select().from(entities).where(sql`lower(${entities.name}) = lower(${name})`).limit(1)

    if (existing[0]) {
      const merged = { ...(existing[0].attributes as Record<string, unknown>), ...attributes }
      await db
        .update(entities)
        .set({
          lastMentionedAt: new Date(),
          mentionCount: sql`${entities.mentionCount} + 1`,
          attributes: merged,
          salience: Math.min(1, existing[0].salience + 0.02)
        })
        .where(eq(entities.id, existing[0].id))
      return existing[0].id
    }

    const rows = await db.insert(entities).values({ name, type, attributes, source }).returning({ id: entities.id })

    const first = rows[0]
    if (!first) throw new Error("Expected row from entity insert")
    return first.id
  })
}

/**
 * Insert or strengthen a relation between two entities.
 */
export function upsertRelation(
  sourceEntityId: string,
  targetEntityId: string,
  relationType: string,
  source: EntityRelationInsert["source"],
  description?: string,
  episodeId?: string
): AnimaResultAsync<string> {
  return trySafe("GRAPH_ERROR", async () => {
    const existing = await db
      .select()
      .from(entityRelations)
      .where(
        and(
          eq(entityRelations.sourceEntityId, sourceEntityId),
          eq(entityRelations.targetEntityId, targetEntityId),
          eq(entityRelations.relationType, relationType)
        )
      )
      .limit(1)

    if (existing[0]) {
      const newStrength = Math.min(1, existing[0].strength + GRAPH_CONSTANTS.STRENGTH_BUMP)
      await db
        .update(entityRelations)
        .set({ strength: newStrength, description: description ?? existing[0].description })
        .where(eq(entityRelations.id, existing[0].id))
      return existing[0].id
    }

    const rows = await db
      .insert(entityRelations)
      .values({ sourceEntityId, targetEntityId, relationType, source, description, episodeId })
      .returning({ id: entityRelations.id })

    const first = rows[0]
    if (!first) throw new Error("Expected row from entity relation insert")
    return first.id
  })
}

/**
 * Record that an entity was mentioned in a tick.
 */
export function recordMention(
  entityId: string,
  tickId: string,
  context: string,
  sentiment: number = 0
): AnimaResultAsync<void> {
  return trySafe("GRAPH_ERROR", async () => {
    await db.insert(entityMentions).values({ entityId, tickId, context, sentiment })
  })
}

/**
 * Find an entity by exact or fuzzy name match.
 */
export function getEntityByName(name: string): AnimaResultAsync<EntitySelect | null> {
  return trySafe("GRAPH_ERROR", async () => {
    const rows = await db.select().from(entities).where(sql`lower(${entities.name}) = lower(${name})`).limit(1)
    return rows[0] ?? null
  })
}

/**
 * Get all entities above the forgotten threshold, ordered by salience.
 */
export function getHighSalienceEntities(limit: number = 10): AnimaResultAsync<EntitySelect[]> {
  return trySafe("GRAPH_ERROR", async () => {
    return db
      .select()
      .from(entities)
      .where(gt(entities.salience, GRAPH_CONSTANTS.SALIENCE_FORGOTTEN_THRESHOLD))
      .orderBy(desc(entities.salience))
      .limit(limit)
  })
}

/**
 * Get all entities (for decay operations).
 */
export function getAllActiveEntities(): AnimaResultAsync<EntitySelect[]> {
  return trySafe("GRAPH_ERROR", async () => {
    return db.select().from(entities).where(gt(entities.salience, GRAPH_CONSTANTS.SALIENCE_FORGOTTEN_THRESHOLD))
  })
}

/**
 * Batch-update salience values for multiple entities.
 */
export function bulkUpdateSalience(updates: Array<{ id: string; salience: number }>): AnimaResultAsync<void> {
  return trySafe("GRAPH_ERROR", async () => {
    for (const { id, salience } of updates) {
      await db.update(entities).set({ salience }).where(eq(entities.id, id))
    }
  })
}
