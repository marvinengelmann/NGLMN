import { desc, eq, ilike } from "drizzle-orm"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import * as z from "zod"
import { db } from "@/infra/db/client.ts"
import { semanticMemory } from "@/infra/db/schema.ts"
import { vectorIndex } from "@/infra/integrations/vector.ts"

export function registerMemoryTools(server: McpServer) {
  server.tool(
    "search_semantic_memory",
    "Search ANIMA's semantic (long-term) memory by category and/or keyword.",
    {
      category: z
        .enum(["preference", "project", "contact", "knowledge", "insight"])
        .optional()
        .describe("Filter by category"),
      scope: z.enum(["self", "operator", "world"]).optional().describe("Filter by scope"),
      keyword: z.string().optional().describe("Search key or value by keyword (case-insensitive)"),
      limit: z.number().min(1).max(100).default(20).describe("Max results")
    },
    async ({ category, scope, keyword, limit }) => {
      let query = db.select().from(semanticMemory).orderBy(desc(semanticMemory.updatedAt)).limit(limit).$dynamic()

      if (category) query = query.where(eq(semanticMemory.category, category))
      if (scope) query = query.where(eq(semanticMemory.scope, scope))
      if (keyword) query = query.where(ilike(semanticMemory.key, `%${keyword}%`))

      const rows = await query
      return text(rows)
    }
  )

  server.tool(
    "search_episodic_memory",
    "Search ANIMA's episodic (vector) memory by natural language query.",
    {
      query: z.string().describe("Natural language search query"),
      topK: z.number().min(1).max(50).default(10).describe("Number of results"),
      namespace: z.string().optional().describe("Vector namespace to search in")
    },
    async ({ query, topK, namespace }) => {
      const results = await vectorIndex.query({
        data: query,
        topK,
        includeData: true,
        includeMetadata: true,
        ...(namespace ? { namespace } : {})
      })
      return text(results)
    }
  )

  server.tool(
    "get_vector_stats",
    "Get statistics about the episodic vector index (namespaces, counts).",
    {},
    async () => {
      const info = await vectorIndex.info()
      return text(info)
    }
  )
}

function text(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
}
