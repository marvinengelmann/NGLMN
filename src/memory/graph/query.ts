import { desc, eq, gt, inArray, or } from "drizzle-orm"
import { db } from "@/infra/db/client.ts"
import type { EntityRelationSelect, EntitySelect } from "@/infra/db/schema.ts"
import { entities, entityRelations } from "@/infra/db/schema.ts"
import type { AnimaResultAsync } from "@/infra/lib/result.ts"
import { trySafe } from "@/infra/lib/result.ts"
import { GRAPH_CONSTANTS } from "./types.ts"

export interface EntitySubgraph {
  entities: EntitySelect[]
  relations: EntityRelationSelect[]
}

/**
 * Fetch a subgraph around seed entities — the entities themselves plus 1-hop relations and neighbors.
 */
export function getEntitySubgraph(entityIds: string[], hops: number = 1): AnimaResultAsync<EntitySubgraph> {
  return trySafe("GRAPH_ERROR", async () => {
    if (entityIds.length === 0) return { entities: [], relations: [] }

    const seedEntities = await db.select().from(entities).where(inArray(entities.id, entityIds))

    if (hops === 0) return { entities: seedEntities, relations: [] }

    const relations = await db
      .select()
      .from(entityRelations)
      .where(or(inArray(entityRelations.sourceEntityId, entityIds), inArray(entityRelations.targetEntityId, entityIds)))

    const neighborIds = new Set<string>()
    for (const rel of relations) {
      if (!entityIds.includes(rel.sourceEntityId)) neighborIds.add(rel.sourceEntityId)
      if (!entityIds.includes(rel.targetEntityId)) neighborIds.add(rel.targetEntityId)
    }

    const neighborIdArray = [...neighborIds]
    const neighbors =
      neighborIdArray.length > 0 ? await db.select().from(entities).where(inArray(entities.id, neighborIdArray)) : []

    const allEntities = [...seedEntities, ...neighbors]
    const seen = new Set<string>()
    const deduped = allEntities.filter((e) => {
      if (seen.has(e.id)) return false
      seen.add(e.id)
      return true
    })

    return { entities: deduped, relations }
  })
}

/**
 * Find entities relevant to the current conversation by matching known entity names against the text.
 * Also includes high-salience entities that are always contextually relevant.
 */
export function getRelevantEntities(conversationText: string, limit: number = 15): AnimaResultAsync<EntitySelect[]> {
  return trySafe("GRAPH_ERROR", async () => {
    const allActive = await db
      .select()
      .from(entities)
      .where(gt(entities.salience, GRAPH_CONSTANTS.SALIENCE_FORGOTTEN_THRESHOLD))
      .orderBy(desc(entities.salience))

    const textLower = conversationText.toLowerCase()

    const scored = allActive.map((entity) => {
      const nameMatch = textLower.includes(entity.name.toLowerCase()) ? 1 : 0
      return { entity, score: nameMatch * 2 + entity.salience }
    })

    scored.sort((a, b) => b.score - a.score)

    return scored.slice(0, limit).map((s) => s.entity)
  })
}

/**
 * Get entities by type.
 */
export function getEntitiesByType(type: EntitySelect["type"], limit: number = 10): AnimaResultAsync<EntitySelect[]> {
  return trySafe("GRAPH_ERROR", async () => {
    return db
      .select()
      .from(entities)
      .where(eq(entities.type, type))
      .orderBy(desc(entities.salience))
      .limit(limit)
  })
}
