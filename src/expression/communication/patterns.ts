import { subDays } from "date-fns"
import { desc, gte } from "drizzle-orm"
import * as z from "zod"
import { callIntelligence } from "@/core/intelligence.ts"
import { db } from "@/infra/db/client.ts"
import { conversationArcs } from "@/infra/db/schema.ts"
import { redis } from "@/infra/integrations/redis.ts"
import { log } from "@/infra/lib/logger.ts"

const REDIS_KEY = "working:conversation:patterns"

const PatternAnalysis = z.object({
  patterns: z.array(z.string()).max(5),
  recurringUnresolved: z.array(z.string()).max(3)
})

export interface ConversationPatterns {
  patterns: string[]
  recurringUnresolved: string[]
}

/**
 * Analyze conversation arcs for recurring patterns and unresolved topics.
 */
export async function analyzeConversationPatterns(days = 14): Promise<ConversationPatterns> {
  const empty: ConversationPatterns = { patterns: [], recurringUnresolved: [] }

  const cached = await redis.get<ConversationPatterns>(REDIS_KEY)
  if (cached) return cached

  const since = subDays(new Date(), days)
  const arcs = await db
    .select()
    .from(conversationArcs)
    .where(gte(conversationArcs.createdAt, since))
    .orderBy(desc(conversationArcs.createdAt))
    .limit(20)

  if (arcs.length < 3) return empty

  const summaryLines = arcs.map((arc) => {
    const themes = Array.isArray(arc.themes) ? (arc.themes as string[]).join(", ") : String(arc.themes)
    const unresolved = Array.isArray(arc.unresolvedTopics)
      ? (arc.unresolvedTopics as string[]).join(", ")
      : String(arc.unresolvedTopics)
    const emotionalArc = arc.emotionalArc as { start: number; peak: number; end: number }
    return `[${arc.tone}] themes: ${themes} | arc: ${emotionalArc.start.toFixed(1)}→${emotionalArc.peak.toFixed(1)}→${emotionalArc.end.toFixed(1)} | engagement: ${arc.operatorEngagement.toFixed(2)} | unresolved: ${unresolved || "none"}`
  })

  const result = await callIntelligence({
    system: `Analyze these conversation summaries and identify:
1. Recurring patterns (theme→emotion correlations, engagement trends, repeated dynamics). Max 5 patterns.
2. Recurring unresolved topics that keep appearing across conversations. Max 3 topics.

Be concise — each pattern/topic should be one sentence.`,
    userMessage: summaryLines.join("\n"),
    schema: PatternAnalysis,
    maxTokens: 512,
    reasoning: false
  })

  if (result.isErr()) {
    log.warn("Failed to analyze conversation patterns", { error: result.error.message })
    return empty
  }

  const patterns = result.value
  await redis.set(REDIS_KEY, patterns, { ex: 3600 })
  return patterns
}

/**
 * Retrieve recent conversation arcs from the database.
 */
export async function getRecentConversationArcs(limit = 10) {
  return db.select().from(conversationArcs).orderBy(desc(conversationArcs.createdAt)).limit(limit)
}
