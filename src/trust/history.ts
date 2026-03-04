import { eq } from "drizzle-orm"
import { db } from "@/db/client.ts"
import { trustLevels } from "@/db/schema.ts"
import type { AnimaResultAsync } from "@/lib/result.ts"
import { trySafe } from "@/lib/result.ts"
import { ensureTrustLevel } from "./levels.ts"
import type { ActionType } from "./types.ts"

/**
 * Record a successful action — increments totalAttempts and successfulAttempts.
 */
export function recordSuccess(actionType: ActionType): AnimaResultAsync<void> {
  return trySafe("DB_ERROR", async () => {
    await ensureTrustLevel(actionType)

    const rows = await db.select().from(trustLevels).where(eq(trustLevels.actionType, actionType)).limit(1)

    const current = rows[0]
    if (!current) {
      throw new Error(`Expected trust level row not found for recordSuccess: ${actionType}`)
    }

    await db
      .update(trustLevels)
      .set({
        totalAttempts: (current.totalAttempts ?? 0) + 1,
        successfulAttempts: (current.successfulAttempts ?? 0) + 1,
        lastAttemptAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(trustLevels.actionType, actionType))
  })
}

/**
 * Record a failed action — increments only totalAttempts.
 */
export function recordFailure(actionType: ActionType): AnimaResultAsync<void> {
  return trySafe("DB_ERROR", async () => {
    await ensureTrustLevel(actionType)

    const rows = await db.select().from(trustLevels).where(eq(trustLevels.actionType, actionType)).limit(1)

    const current = rows[0]
    if (!current) {
      throw new Error(`Expected trust level row not found for recordFailure: ${actionType}`)
    }

    await db
      .update(trustLevels)
      .set({
        totalAttempts: (current.totalAttempts ?? 0) + 1,
        lastAttemptAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(trustLevels.actionType, actionType))
  })
}
