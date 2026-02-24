import { eq } from "drizzle-orm"
import type { AnimaResultAsync } from "@/config/result-helpers.ts"
import { trySafe } from "@/config/result-helpers.ts"
import { db } from "@/db/client.ts"
import { trustLevels } from "@/db/schema.ts"
import { clamp01 } from "@/lib/math.ts"
import { ensureTrustLevel } from "./levels.ts"
import type { ActionType } from "./types.ts"

/**
 * Record a successful action — decreases fear, increases confidence.
 */
export function recordSuccess(actionType: ActionType): AnimaResultAsync<void> {
  return trySafe("DB_ERROR", async () => {
    await ensureTrustLevel(actionType)

    await db.transaction(async (tx) => {
      const rows = await tx.select().from(trustLevels).where(eq(trustLevels.actionType, actionType)).limit(1)

      const current = rows[0]
      if (!current) {
        throw new Error(`Expected trust level row not found for recordSuccess: ${actionType}`)
      }

      await tx
        .update(trustLevels)
        .set({
          fear: clamp01((current.fear ?? 0.8) - 0.05),
          confidence: clamp01((current.confidence ?? 0.1) + 0.03),
          totalAttempts: (current.totalAttempts ?? 0) + 1,
          successfulAttempts: (current.successfulAttempts ?? 0) + 1,
          lastAttemptAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(trustLevels.actionType, actionType))
    })
  })
}

/**
 * Record a failed action — increases fear, decreases confidence.
 */
export function recordFailure(actionType: ActionType): AnimaResultAsync<void> {
  return trySafe("DB_ERROR", async () => {
    await ensureTrustLevel(actionType)

    await db.transaction(async (tx) => {
      const rows = await tx.select().from(trustLevels).where(eq(trustLevels.actionType, actionType)).limit(1)

      const current = rows[0]
      if (!current) {
        throw new Error(`Expected trust level row not found for recordFailure: ${actionType}`)
      }

      await tx
        .update(trustLevels)
        .set({
          fear: clamp01((current.fear ?? 0.8) + 0.1),
          confidence: clamp01((current.confidence ?? 0.1) - 0.05),
          totalAttempts: (current.totalAttempts ?? 0) + 1,
          lastAttemptAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(trustLevels.actionType, actionType))
    })
  })
}
