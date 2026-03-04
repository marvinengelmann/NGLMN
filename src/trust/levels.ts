import { eq } from "drizzle-orm"
import { db } from "@/db/client.ts"
import { trustLevels } from "@/db/schema.ts"
import type { ActionType } from "./types.ts"

/**
 * Get the trust level for a specific action type.
 */
export async function getTrustLevel(actionType: ActionType) {
  const rows = await db.select().from(trustLevels).where(eq(trustLevels.actionType, actionType)).limit(1)

  const row = rows[0]
  if (!row) {
    return {
      actionType,
      totalAttempts: 0,
      successfulAttempts: 0,
      lastAttemptAt: null as Date | null
    }
  }
  return {
    actionType: row.actionType,
    totalAttempts: row.totalAttempts ?? 0,
    successfulAttempts: row.successfulAttempts ?? 0,
    lastAttemptAt: row.lastAttemptAt
  }
}

/**
 * Ensure a trust level entry exists for the given action type.
 * Creates one with defaults if it doesn't exist.
 */
export async function ensureTrustLevel(actionType: ActionType): Promise<void> {
  const existing = await db.select().from(trustLevels).where(eq(trustLevels.actionType, actionType)).limit(1)

  if (existing.length === 0) {
    await db.insert(trustLevels).values({
      actionType,
      totalAttempts: 0,
      successfulAttempts: 0
    })
  }
}

/**
 * Get all trust level entries.
 */
export async function getAllTrustLevels() {
  return db.select().from(trustLevels)
}
