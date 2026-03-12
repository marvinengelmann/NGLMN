import { subDays, subHours } from "date-fns"
import { and, desc, eq, gte, isNull, lt } from "drizzle-orm"
import { db } from "@/infra/db/client.ts"
import { type InteractionOutcomeSelect, interactionOutcomes } from "@/infra/db/schema.ts"
import { computeOutcomeScore, type InteractionStrategy, type OperatorReaction } from "./types.ts"

/**
 * Create a new unresolved interaction outcome after sending a message.
 */
export async function createOutcome(
  tickId: string,
  conversationId: string | null,
  strategy: InteractionStrategy,
  responseText: string
): Promise<string> {
  const rows = await db
    .insert(interactionOutcomes)
    .values({
      tickId,
      conversationId,
      strategy,
      responseText
    })
    .returning({ id: interactionOutcomes.id })

  const first = rows[0]
  if (!first) throw new Error("Expected row from outcome creation")
  return first.id
}

/**
 * Resolve an outcome with operator reaction data and computed score.
 */
/**
 * Resolve an outcome with operator reaction data and computed score.
 * Returns the computed outcome score for downstream reinforcement.
 */
export async function resolveOutcome(outcomeId: string, reaction: OperatorReaction): Promise<number> {
  const score = computeOutcomeScore(reaction)

  await db
    .update(interactionOutcomes)
    .set({
      operatorReaction: reaction,
      outcomeScore: score,
      resolvedAt: new Date()
    })
    .where(eq(interactionOutcomes.id, outcomeId))

  return score
}

/**
 * Get the most recent unresolved outcome.
 */
export async function getUnresolvedOutcome() {
  const rows = await db
    .select()
    .from(interactionOutcomes)
    .where(isNull(interactionOutcomes.resolvedAt))
    .orderBy(desc(interactionOutcomes.createdAt))
    .limit(1)

  return rows[0] ?? null
}

/**
 * Get all unresolved outcomes, ordered by creation time (oldest first).
 */
export async function getUnresolvedOutcomes(): Promise<InteractionOutcomeSelect[]> {
  return db
    .select()
    .from(interactionOutcomes)
    .where(isNull(interactionOutcomes.resolvedAt))
    .orderBy(interactionOutcomes.createdAt)
}

/**
 * Expire stale unresolved outcomes older than 24 hours with a low score.
 * Returns the number of expired outcomes.
 */
export async function expireStaleOutcomes(): Promise<number> {
  const cutoff = subHours(new Date(), 24)
  const stale = await db
    .select({ id: interactionOutcomes.id })
    .from(interactionOutcomes)
    .where(and(isNull(interactionOutcomes.resolvedAt), lt(interactionOutcomes.createdAt, cutoff)))

  if (stale.length === 0) return 0

  for (const row of stale) {
    await db
      .update(interactionOutcomes)
      .set({
        outcomeScore: 0.15,
        resolvedAt: new Date(),
        operatorReaction: {
          repliedWithinMinutes: null,
          sentiment: "neutral",
          engagementDelta: 0,
          conversationContinued: false
        }
      })
      .where(eq(interactionOutcomes.id, row.id))
  }

  return stale.length
}

/**
 * Get resolved outcomes from the last N days.
 */
export async function getRecentOutcomes(days: number = 7) {
  const since = subDays(new Date(), days)
  return db
    .select()
    .from(interactionOutcomes)
    .where(gte(interactionOutcomes.createdAt, since))
    .orderBy(desc(interactionOutcomes.createdAt))
}
