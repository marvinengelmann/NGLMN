import { eq } from "drizzle-orm"
import { db } from "@/infra/db/client.ts"
import { semanticMemory } from "@/infra/db/schema.ts"
import { log } from "@/infra/lib/logger.ts"
import { updateConfidence } from "@/memory/semantic.ts"

const POSITIVE_BOOST = 0.05
const NEGATIVE_PENALTY = 0.03
const POSITIVE_THRESHOLD = 0.6
const NEGATIVE_THRESHOLD = 0.3

/**
 * Reinforce or weaken an insight's confidence based on outcome score.
 */
export async function reinforceInsight(insightId: string, outcomeScore: number): Promise<void> {
  const rows = await db
    .select({ confidence: semanticMemory.confidence })
    .from(semanticMemory)
    .where(eq(semanticMemory.id, insightId))
    .limit(1)

  const current = rows[0]?.confidence ?? 0.5

  let newConfidence: number
  if (outcomeScore > POSITIVE_THRESHOLD) {
    newConfidence = Math.min(1, current + POSITIVE_BOOST)
  } else if (outcomeScore < NEGATIVE_THRESHOLD) {
    newConfidence = Math.max(0, current - NEGATIVE_PENALTY)
  } else {
    return
  }

  const result = await updateConfidence(insightId, newConfidence)
  if (result.isOk()) {
    log.info("Insight confidence updated", { insightId, from: current, to: newConfidence })
  }
}
