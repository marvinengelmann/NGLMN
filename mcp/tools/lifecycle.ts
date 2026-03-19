import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { db } from "@/infra/db/client.ts"
import { genesis } from "@/infra/db/schema.ts"
import { redis } from "@/infra/integrations/redis.ts"

const LIFECYCLE_KEYS = {
  event: "working:lifecycle:event",
  eventMeta: "working:lifecycle:event:meta",
  lastRolledUpdateId: "working:lifecycle:lastRolledUpdateId"
} as const

const LIFECYCLE_HISTORY_KEY = "working:lifecycle:history"

const INTEGRATION_KEYS = {
  telegramLastUpdateId: "working:telegram:lastUpdateId",
  socialLastBrowse: "working:social:lastBrowse",
  socialLastPost: "working:social:lastPost",
  emailLastCheck: "working:email:lastCheck",
  calendarLastCheck: "working:calendar:lastCheck",
  xUserId: "working:x:userId",
  processAlive: "working:process:alive",
  taskActive: "working:task:active",
  reflectionLastAt: "working:reflection:lastAt"
} as const

export function registerLifecycleTools(server: McpServer) {
  server.tool(
    "get_lifecycle_state",
    "Get current life events (sleep/wake, first interaction, etc.), event metadata, and lifecycle history.",
    {},
    async () => {
      const result: Record<string, unknown> = {}
      for (const [label, key] of Object.entries(LIFECYCLE_KEYS)) {
        result[label] = await redis.get(key)
      }
      result.history = await redis.lrange(LIFECYCLE_HISTORY_KEY, 0, -1)
      return text(result)
    }
  )

  server.tool(
    "get_integration_status",
    "Get integration cooldown timestamps: last Telegram poll, social media browse/post, email/calendar checks, X user ID, process heartbeat, and active task state.",
    {},
    async () => {
      const result: Record<string, unknown> = {}
      for (const [label, key] of Object.entries(INTEGRATION_KEYS)) {
        result[label] = await redis.get(key)
      }
      return text(result)
    }
  )

  server.tool(
    "get_personality",
    "Get ANIMA's genesis record: personality seed, DNA (Big Five traits), identity (name, gender, MBTI), and voice ID.",
    {},
    async () => {
      const rows = await db.select().from(genesis).limit(1)
      if (rows.length === 0) return text({ error: "No genesis record found" })
      return text(rows[0])
    }
  )
}

function text(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
}
