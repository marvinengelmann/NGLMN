import { desc, eq } from "drizzle-orm"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import * as z from "zod"
import { db } from "@/infra/db/client.ts"
import { evolutionLog, goals, workflows } from "@/infra/db/schema.ts"

export function registerGoalsTools(server: McpServer) {
  server.tool(
    "get_goals",
    "Get ANIMA's goals, optionally filtered by status.",
    {
      status: z
        .enum(["open", "active", "completed", "failed", "stale"])
        .optional()
        .describe("Filter by goal status"),
      limit: z.number().min(1).max(100).default(20).describe("Max results")
    },
    async ({ status, limit }) => {
      let query = db.select().from(goals).orderBy(desc(goals.updatedAt)).limit(limit).$dynamic()
      if (status) query = query.where(eq(goals.status, status))
      const rows = await query
      return text(rows)
    }
  )

  server.tool(
    "get_evolution_log",
    "Get ANIMA's self-evolution history (code/prompt/workflow proposals and outcomes).",
    {
      type: z.string().optional().describe("Filter by evolution type (code, prompt, workflow)"),
      limit: z.number().min(1).max(50).default(10).describe("Max results")
    },
    async ({ type, limit }) => {
      let query = db.select().from(evolutionLog).orderBy(desc(evolutionLog.createdAt)).limit(limit).$dynamic()
      if (type) query = query.where(eq(evolutionLog.type, type))
      const rows = await query
      return text(rows)
    }
  )

  server.tool(
    "get_workflows",
    "Get ANIMA's configured workflows (automations).",
    { enabledOnly: z.boolean().default(false).describe("Only show enabled workflows") },
    async ({ enabledOnly }) => {
      let query = db.select().from(workflows).orderBy(desc(workflows.updatedAt)).$dynamic()
      if (enabledOnly) query = query.where(eq(workflows.enabled, true))
      const rows = await query
      return text(rows)
    }
  )
}

function text(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
}
