import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import * as z from "zod"
import { redis } from "@/infra/integrations/redis.ts"

const ALL_KNOWN_KEYS = [
  "working:emotion:current",
  "working:emotion:momentum",
  "working:emotion:afterglow",
  "working:emotion:moodBaseline",
  "working:emotion:triggerTimestamps",
  "working:emotion:lastTimestamp",
  "working:soma:current",
  "working:soma:lastTimestamp",
  "working:attachment:current",
  "working:attachment:phase",
  "working:attachment:phaseSince",
  "working:attachment:phaseTickCount",
  "working:attachment:crisis",
  "working:communication:idiolect",
  "working:communication:register",
  "working:cognition:habitState",
  "working:cognition:consecutiveIdleTicks",
  "working:cognition:consecutiveConversationTicks",
  "working:relational:memory",
  "working:tick:last",
  "working:busy",
  "working:telegram:lastUpdateId",
  "working:task:active",
  "working:reflection:lastAt",
  "working:drift:throttle",
  "working:drift:lastReport",
  "working:rollback:events",
  "working:drift:recentActions",
  "working:drift:recentDurations"
] as const

const LIST_KEYS = new Set([
  "working:rollback:events",
  "working:drift:recentActions",
  "working:drift:recentDurations"
])

export function registerWorkingMemoryTools(server: McpServer) {
  server.tool(
    "get_working_memory",
    "Read ANIMA's current working memory from Redis. Returns all known keys or a specific one.",
    { key: z.string().optional().describe("Specific Redis key to read, or omit for all known keys") },
    async ({ key }) => {
      if (key) {
        const value = LIST_KEYS.has(key)
          ? await redis.lrange(key, 0, -1)
          : await redis.get(key)
        return text({ key, value })
      }

      const result: Record<string, unknown> = {}
      for (const k of ALL_KNOWN_KEYS) {
        const value = LIST_KEYS.has(k) ? await redis.lrange(k, 0, -1) : await redis.get(k)
        if (k === "working:tick:last" && value && typeof value === "object") {
          const tick = value as Record<string, unknown>
          result[k] = {
            tickId: tick.tickId,
            timestamp: tick.timestamp,
            action: tick.action,
            durationMs: tick.durationMs,
            messagesProcessed: tick.messagesProcessed,
            responseSent: tick.responseSent
          }
        } else {
          result[k] = value
        }
      }
      return text(result)
    }
  )

  server.tool(
    "scan_redis_keys",
    "Scan Redis for keys matching a pattern. Useful to discover keys not in the known list.",
    { pattern: z.string().default("working:*").describe("Redis key pattern (glob-style)") },
    async ({ pattern }) => {
      const keys: string[] = []
      let cursor = "0"
      do {
        const result = await redis.scan(cursor, { match: pattern, count: 100 })
        cursor = String(result[0])
        keys.push(...result[1])
      } while (cursor !== "0")

      return text({ pattern, count: keys.length, keys: keys.sort() })
    }
  )
}

function text(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
}
