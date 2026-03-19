import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import * as z from "zod"
import { redis } from "@/infra/integrations/redis.ts"

export function registerAdminTools(server: McpServer) {
  server.tool(
    "set_redis_key",
    "Set a Redis key to a specific value. Accepts JSON objects/arrays or plain strings. Use for testing and development.",
    {
      key: z.string().describe("The Redis key to set"),
      value: z.string().describe("The value to set (JSON string for objects/arrays, or plain string)")
    },
    async ({ key, value }) => {
      let parsed: unknown
      try {
        parsed = JSON.parse(value)
      } catch {
        parsed = value
      }
      await redis.set(key, parsed)
      return text({ success: true, key, valueType: typeof parsed === "object" ? "json" : "string" })
    }
  )

  server.tool(
    "delete_redis_key",
    "Delete a Redis key. Use for resetting state during development/debugging.",
    {
      key: z.string().describe("The Redis key to delete")
    },
    async ({ key }) => {
      const existed = await redis.del(key)
      return text({ success: true, key, existed: existed > 0 })
    }
  )

  server.tool(
    "reset_busy_lock",
    "Reset the busy lock (working:busy) that prevents concurrent tick execution. Use when a tick is stuck and the lock was not released.",
    {},
    async () => {
      const existed = await redis.del("working:busy")
      return text({ success: true, busyLockExisted: existed > 0 })
    }
  )
}

function text(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
}
