import { desc } from "drizzle-orm"
import type { MetricsSnapshot } from "@/affect/emotion/types.ts"
import { db } from "@/infra/db/client.ts"
import { tickLog } from "@/infra/db/schema.ts"
import { getRecentRollbackCount } from "@/memory/working.ts"

/**
 * Collect current metrics from tick log and working memory.
 */
export async function collectMetrics(): Promise<MetricsSnapshot> {
  const recentTicks = await db.select().from(tickLog).orderBy(desc(tickLog.createdAt)).limit(50)

  const tickCount = recentTicks.length

  const rollbackCount = await getRecentRollbackCount(24)

  if (tickCount === 0) {
    return {
      errorRate: 0,
      successRate: 1,
      idleRatio: 1,
      rollbackCount,
      tickCount: 0,
      interactionCount: 0
    }
  }

  const idleTicks = recentTicks.filter((t) => t.action === "idle").length
  const interactionTicks = recentTicks.filter((t) => t.responseSent).length
  const errorTicks = recentTicks.filter(
    (t) => t.messagesProcessed > 0 && !t.responseSent && t.action !== "idle" && t.action !== "dream"
  ).length

  return {
    errorRate: errorTicks / tickCount,
    successRate: interactionTicks / tickCount,
    idleRatio: idleTicks / tickCount,
    rollbackCount,
    tickCount,
    interactionCount: interactionTicks
  }
}
