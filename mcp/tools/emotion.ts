import { desc } from "drizzle-orm"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import * as z from "zod"
import { db } from "@/infra/db/client.ts"
import { emotionHistory, somaticHistory } from "@/infra/db/schema.ts"
import { redis } from "@/infra/integrations/redis.ts"

const EMOTION_KEYS = {
  current: "working:emotion:current",
  momentum: "working:emotion:momentum",
  afterglow: "working:emotion:afterglow",
  moodBaseline: "working:emotion:moodBaseline",
  triggerTimestamps: "working:emotion:triggerTimestamps",
  lastTimestamp: "working:emotion:lastTimestamp"
} as const

const SOMA_KEYS = {
  current: "working:soma:current",
  lastTimestamp: "working:soma:lastTimestamp"
} as const

export function registerEmotionTools(server: McpServer) {
  server.tool(
    "get_emotional_state",
    "Get ANIMA's current emotional state (9 dimensions: curiosity, satisfaction, frustration, boredom, excitement, caution, connection, confidence, energy) plus momentum, afterglow, and mood baseline.",
    {},
    async () => {
      const result: Record<string, unknown> = {}
      for (const [label, key] of Object.entries(EMOTION_KEYS)) {
        result[label] = await redis.get(key)
      }
      return text(result)
    }
  )

  server.tool(
    "get_somatic_state",
    "Get ANIMA's current somatic/body state (social battery, heart rate, muscle tension, etc.).",
    {},
    async () => {
      const result: Record<string, unknown> = {}
      for (const [label, key] of Object.entries(SOMA_KEYS)) {
        result[label] = await redis.get(key)
      }
      return text(result)
    }
  )

  server.tool(
    "get_emotion_history",
    "Get emotion history entries from Postgres, ordered by most recent.",
    { limit: z.number().min(1).max(100).default(10).describe("Number of entries to return") },
    async ({ limit }) => {
      const rows = await db.select().from(emotionHistory).orderBy(desc(emotionHistory.createdAt)).limit(limit)
      return text(rows)
    }
  )

  server.tool(
    "get_somatic_history",
    "Get somatic state history from Postgres.",
    { limit: z.number().min(1).max(50).default(10).describe("Number of entries to return") },
    async ({ limit }) => {
      const rows = await db.select().from(somaticHistory).orderBy(desc(somaticHistory.createdAt)).limit(limit)
      return text(rows)
    }
  )

  server.tool(
    "get_secondary_emotions",
    "Get all active secondary emotions (shame, guilt, pride, envy, etc.) from Redis.",
    {},
    async () => {
      const secondaryKeys = [
        "working:emotion:shame",
        "working:emotion:guilt",
        "working:emotion:pride",
        "working:emotion:hope",
        "working:emotion:awe",
        "working:emotion:tenderness",
        "working:emotion:envy",
        "working:emotion:gratitude",
        "working:emotion:playfulness",
        "working:emotion:melancholy",
        "working:emotion:longing",
        "working:emotion:resignation",
        "working:emotion:disappointment",
        "working:emotion:resentment",
        "working:emotion:anticipation",
        "working:emotion:ambivalence",
        "working:emotion:protective-anger"
      ]

      const result: Record<string, unknown> = {}
      for (const key of secondaryKeys) {
        const value = await redis.get(key)
        if (value != null) {
          const name = key.replace("working:emotion:", "")
          result[name] = value
        }
      }
      return text(result)
    }
  )
}

function text(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
}
