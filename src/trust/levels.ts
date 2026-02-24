import { eq } from "drizzle-orm"
import { db } from "@/db/client.ts"
import { trustLevels } from "@/db/schema.ts"
import type { ActionType } from "./types.ts"

const DEFAULT_FEAR = 0.8
const DEFAULT_CONFIDENCE = 0.1

/**
 * Get the trust level for a specific action type.
 */
export async function getTrustLevel(actionType: ActionType) {
  const rows = await db.select().from(trustLevels).where(eq(trustLevels.actionType, actionType)).limit(1)

  const row = rows[0]
  if (!row) {
    return {
      actionType,
      fear: DEFAULT_FEAR,
      confidence: DEFAULT_CONFIDENCE,
      totalAttempts: 0,
      successfulAttempts: 0
    }
  }
  return row
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
      fear: DEFAULT_FEAR,
      confidence: DEFAULT_CONFIDENCE,
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
