import { db } from "@/db/client.ts"
import { dissonanceLog } from "@/db/schema.ts"
import { getValidatedRedisOr, redis } from "@/integrations/redis.ts"
import { type DissonanceEvent, DissonanceState } from "./types.ts"

const KEYS = {
  ACTIVE: "working:dissonance:active",
  SCORE: "working:dissonance:score"
} as const

/**
 * Get current dissonance state from Redis.
 */
export async function getDissonanceState(): Promise<DissonanceState> {
  return getValidatedRedisOr(KEYS.ACTIVE, DissonanceState, {
    activeDissonance: 0,
    recentEvents: [],
    cumulativeUnresolved: 0
  })
}

/**
 * Save dissonance state to Redis.
 */
export async function saveDissonanceState(state: DissonanceState): Promise<void> {
  await redis.set(KEYS.ACTIVE, state)
  await redis.set(KEYS.SCORE, state.activeDissonance.toString())
}

/**
 * Log a dissonance event to DB.
 */
export async function logDissonanceEvent(event: DissonanceEvent): Promise<void> {
  await db.insert(dissonanceLog).values({
    declaredValue: event.declaredValue,
    actualAction: event.actualAction,
    dissonanceScore: event.dissonanceScore,
    resolution: event.resolution ?? null
  })
}
