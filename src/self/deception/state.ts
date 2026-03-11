import { db } from "@/infra/db/client.ts"
import { deceptionLog } from "@/infra/db/schema.ts"
import { getValidatedRedisOr } from "@/infra/integrations/redis.ts"
import { DEFAULT_DECEPTION_STATE, DeceptionState, type HiddenDriver } from "./types.ts"

const KEY = "working:deception:current"

/**
 * Get the current deception state from Redis.
 */
export async function getDeceptionState(): Promise<DeceptionState> {
  return getValidatedRedisOr(KEY, DeceptionState, DEFAULT_DECEPTION_STATE)
}

/**
 * Log a deception event (hidden or discovered driver) to the database.
 */
export async function logDeceptionEvent(entry: HiddenDriver): Promise<void> {
  await db.insert(deceptionLog).values({
    actualDriver: entry.actualDriver,
    statedReason: entry.statedReason,
    hiddenSince: new Date(entry.hiddenSince),
    discoveredAt: entry.discoveredAt ? new Date(entry.discoveredAt) : null
  })
}
