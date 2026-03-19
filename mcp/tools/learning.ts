import { desc, eq, sql } from "drizzle-orm"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import * as z from "zod"
import { db } from "@/infra/db/client.ts"
import { entities, entityRelations, hebbianAssociations, lessons } from "@/infra/db/schema.ts"

export function registerLearningTools(server: McpServer) {
  server.tool(
    "get_hebbian_associations",
    "Get learned Hebbian associations (stimulus-stimulus pairings): strength, co-activation count, and recency.",
    {
      limit: z.number().min(1).max(100).default(20).describe("Max results"),
      minStrength: z.number().min(0).max(1).default(0).describe("Minimum strength threshold")
    },
    async ({ limit, minStrength }) => {
      let query = db
        .select()
        .from(hebbianAssociations)
        .orderBy(desc(hebbianAssociations.strength))
        .limit(limit)
        .$dynamic()

      if (minStrength > 0) {
        query = query.where(sql`${hebbianAssociations.strength} >= ${minStrength}`)
      }

      const rows = await query
      return text(rows)
    }
  )

  server.tool(
    "get_lessons",
    "Get ANIMA's learned insights: what was learned, confidence, source, and how many times reinforced.",
    {
      limit: z.number().min(1).max(100).default(20).describe("Max results"),
      source: z.string().optional().describe("Filter by source (e.g. 'interaction', 'reflection', 'dream')")
    },
    async ({ limit, source }) => {
      let query = db.select().from(lessons).orderBy(desc(lessons.updatedAt)).limit(limit).$dynamic()
      if (source) query = query.where(eq(lessons.source, source))
      const rows = await query
      return text(rows)
    }
  )

  server.tool(
    "get_entities",
    "Get ANIMA's knowledge graph: named entities (people, places, concepts, etc.) with salience and mention count.",
    {
      limit: z.number().min(1).max(100).default(20).describe("Max results"),
      type: z.string().optional().describe("Filter by entity type (person, place, organization, event, concept, object)"),
      keyword: z.string().optional().describe("Search entity name (case-insensitive)")
    },
    async ({ limit, type, keyword }) => {
      let query = db.select().from(entities).orderBy(desc(entities.salience)).limit(limit).$dynamic()
      if (type) query = query.where(eq(entities.type, type))
      if (keyword) query = query.where(sql`${entities.name} ILIKE ${"%" + keyword + "%"}`)
      const rows = await query
      return text(rows)
    }
  )

  server.tool(
    "get_entity_relations",
    "Get relationships between entities in ANIMA's knowledge graph: source, target, relation type, and strength.",
    {
      entityId: z.string().optional().describe("Filter relations involving this entity ID"),
      limit: z.number().min(1).max(100).default(20).describe("Max results")
    },
    async ({ entityId, limit }) => {
      let query = db.select().from(entityRelations).orderBy(desc(entityRelations.strength)).limit(limit).$dynamic()
      if (entityId) {
        query = query.where(
          sql`${entityRelations.sourceEntityId} = ${entityId} OR ${entityRelations.targetEntityId} = ${entityId}`
        )
      }
      const rows = await query
      return text(rows)
    }
  )
}

function text(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
}
