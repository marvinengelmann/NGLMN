import { desc } from "drizzle-orm"
import { db } from "@/db/client.ts"
import { tickLog } from "@/db/schema.ts"
import type { EmotionalState, MetricsSnapshot } from "@/emotion/types.ts"
import { getRecentRollbackCount } from "@/memory/working.ts"

/**
 * Compare emotional state against hard metrics and return discrepancies.
 */
export function checkEmotionalAccuracy(emotion: EmotionalState, metrics: MetricsSnapshot): string[] {
  const discrepancies: string[] = []

  if (emotion.satisfaction > 0.7 && metrics.errorRate > 0.3) {
    discrepancies.push(
      `High satisfaction (${emotion.satisfaction.toFixed(2)}) despite high error rate (${metrics.errorRate.toFixed(2)})`
    )
  }

  if (emotion.frustration < 0.2 && metrics.errorRate > 0.5) {
    discrepancies.push(
      `Low frustration (${emotion.frustration.toFixed(2)}) despite very high error rate (${metrics.errorRate.toFixed(2)})`
    )
  }

  if (emotion.boredom > 0.7 && metrics.interactionCount > 20) {
    discrepancies.push(
      `High boredom (${emotion.boredom.toFixed(2)}) despite active interactions (${metrics.interactionCount})`
    )
  }

  if (emotion.excitement > 0.8 && metrics.idleRatio > 0.8) {
    discrepancies.push(
      `High excitement (${emotion.excitement.toFixed(2)}) during mostly idle period (${metrics.idleRatio.toFixed(2)})`
    )
  }

  if (emotion.caution < 0.3 && metrics.rollbackCount > 2) {
    discrepancies.push(
      `Low caution (${emotion.caution.toFixed(2)}) despite recent rollbacks (${metrics.rollbackCount})`
    )
  }

  if (emotion.confidence < 0.3 && metrics.successRate > 0.8) {
    discrepancies.push(
      `Low confidence (${emotion.confidence.toFixed(2)}) despite high success rate (${metrics.successRate.toFixed(2)})`
    )
  }

  if (emotion.confidence > 0.8 && metrics.errorRate > 0.4) {
    discrepancies.push(
      `High confidence (${emotion.confidence.toFixed(2)}) despite significant error rate (${metrics.errorRate.toFixed(2)})`
    )
  }

  return discrepancies
}

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
  const errorTicks = recentTicks.filter((t) => t.messagesProcessed > 0 && !t.responseSent).length

  return {
    errorRate: errorTicks / tickCount,
    successRate: interactionTicks / tickCount,
    idleRatio: idleTicks / tickCount,
    rollbackCount,
    tickCount,
    interactionCount: interactionTicks
  }
}
