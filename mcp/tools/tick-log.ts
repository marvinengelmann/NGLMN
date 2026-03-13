import { desc, eq } from "drizzle-orm"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import * as z from "zod"
import { db } from "@/infra/db/client.ts"
import { tickLog } from "@/infra/db/schema.ts"

export function registerTickLogTools(server: McpServer) {
  server.tool(
    "get_tick_log",
    "Get recent tick log entries showing what ANIMA did, why, and how long it took.",
    { limit: z.number().min(1).max(100).default(10).describe("Number of ticks to return") },
    async ({ limit }) => {
      const rows = await db.select().from(tickLog).orderBy(desc(tickLog.createdAt)).limit(limit)
      return text(rows)
    }
  )

  server.tool(
    "get_tick_detail",
    "Get full details of a specific tick by its tickId.",
    { tickId: z.string().describe("The tick ID to look up") },
    async ({ tickId }) => {
      const rows = await db.select().from(tickLog).where(eq(tickLog.tickId, tickId))
      if (rows.length === 0) return text({ error: "Tick not found", tickId })
      return text(rows[0])
    }
  )
}

function text(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
}
