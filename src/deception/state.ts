import { db } from "@/db/client.ts"
import { deceptionLog } from "@/db/schema.ts"
import { redis } from "@/integrations/redis.ts"
import { DEFAULT_DECEPTION_STATE, DeceptionState, type HiddenDriver } from "./types.ts"

const KEY = "working:deception:current"

/**
 * Get the current deception state from Redis.
 */
export async function getDeceptionState(): Promise<DeceptionState> {
  const raw = await redis.get(KEY)
  if (raw == null) return DEFAULT_DECEPTION_STATE
  try {
    const parsed = DeceptionState.safeParse(typeof raw === "string" ? JSON.parse(raw) : raw)
    return parsed.success ? parsed.data : DEFAULT_DECEPTION_STATE
  } catch {
    return DEFAULT_DECEPTION_STATE
  }
}

/**
 * Save the deception state to Redis.
 */
export async function saveDeceptionState(state: DeceptionState): Promise<void> {
  await redis.set(KEY, state)
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
