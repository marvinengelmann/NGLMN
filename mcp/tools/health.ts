import { formatISO } from "date-fns"
import { desc, sql } from "drizzle-orm"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import * as z from "zod"
import { getBudgetState } from "@/core/budget.ts"
import { db } from "@/infra/db/client.ts"
import { attachmentLog, coherenceLog, dissonanceLog, heldBackLog, tickLog } from "@/infra/db/schema.ts"
import { redis } from "@/infra/integrations/redis.ts"

export function registerHealthTools(server: McpServer) {
  server.tool(
    "get_health_overview",
    "Get a comprehensive health overview: budget, busy lock, last tick, drift state, tick frequency, and error indicators.",
    {},
    async () => {
      const [budget, busy, lastTick, driftThrottle, idleTicks, convTicks, taskActive] = await Promise.all([
        getBudgetState(),
        redis.get("working:busy"),
        redis.get("working:tick:last"),
        redis.get("working:drift:throttle"),
        redis.get("working:cognition:consecutiveIdleTicks"),
        redis.get("working:cognition:consecutiveConversationTicks"),
        redis.get("working:task:active")
      ])

      const recentTicks = await db
        .select({
          count: sql<number>`count(*)`,
          avgDuration: sql<number>`avg(${tickLog.durationMs})`,
          maxDuration: sql<number>`max(${tickLog.durationMs})`
        })
        .from(tickLog)
        .where(sql`${tickLog.createdAt} > now() - interval '1 hour'`)

      return text({
        budget,
        busyLock: busy,
        lastTick,
        driftThrottle,
        consecutiveIdleTicks: idleTicks ?? 0,
        consecutiveConversationTicks: convTicks ?? 0,
        taskActive: taskActive === "true",
        lastHourTicks: recentTicks[0] ?? null,
        checkedAt: formatISO(new Date())
      })
    }
  )

  server.tool(
    "get_budget",
    "Get current daily API budget consumption and limits.",
    {},
    async () => {
      const budget = await getBudgetState()
      return text(budget)
    }
  )

  server.tool(
    "get_attachment_state",
    "Get ANIMA's current attachment state and recent attachment log entries.",
    { limit: z.number().min(1).max(50).default(5).describe("Number of log entries") },
    async ({ limit }) => {
      const [current, phase, phaseSince, crisis, logs] = await Promise.all([
        redis.get("working:attachment:current"),
        redis.get("working:attachment:phase"),
        redis.get("working:attachment:phaseSince"),
        redis.get("working:attachment:crisis"),
        db.select().from(attachmentLog).orderBy(desc(attachmentLog.createdAt)).limit(limit)
      ])

      return text({ current, phase, phaseSince, crisis, recentLogs: logs })
    }
  )

  server.tool(
    "get_psychological_state",
    "Get psychological indicators: coherence, dissonance, and held-back thoughts.",
    { limit: z.number().min(1).max(20).default(5).describe("Number of log entries per category") },
    async ({ limit }) => {
      const [coherence, dissonance, heldBack] = await Promise.all([
        db.select().from(coherenceLog).orderBy(desc(coherenceLog.createdAt)).limit(limit),
        db.select().from(dissonanceLog).orderBy(desc(dissonanceLog.createdAt)).limit(limit),
        db.select().from(heldBackLog).orderBy(desc(heldBackLog.createdAt)).limit(limit)
      ])

      return text({ coherence, dissonance, heldBack })
    }
  )

  server.tool(
    "get_drift_state",
    "Get Guardian drift monitoring state: recent actions, durations, throttle, and rollback events.",
    {},
    async () => {
      const [recentActions, recentDurations, throttle, lastReport, rollbackEvents] = await Promise.all([
        redis.lrange("working:drift:recentActions", 0, -1),
        redis.lrange("working:drift:recentDurations", 0, -1),
        redis.get("working:drift:throttle"),
        redis.get("working:drift:lastReport"),
        redis.lrange("working:rollback:events", 0, -1)
      ])

      return text({ recentActions, recentDurations, throttle, lastReport, rollbackEvents })
    }
  )
}

function text(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
}
