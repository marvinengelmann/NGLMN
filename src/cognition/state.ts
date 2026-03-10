import { getValidatedRedis, redis } from "@/infra/integrations/redis.ts"
import { AttentionState, InstinctImpression } from "./types.ts"

const KEYS = {
  INSTINCT: "working:cognition:instinct:lastImpression",
  ATTENTION: "working:cognition:attention"
} as const

/**
 * Get the last instinct impression from Redis.
 */
export async function getLastInstinctImpression(): Promise<InstinctImpression | null> {
  return getValidatedRedis(KEYS.INSTINCT, InstinctImpression)
}

/**
 * Save an instinct impression to Redis.
 */
export async function saveInstinctImpression(impression: InstinctImpression): Promise<void> {
  await redis.set(KEYS.INSTINCT, impression)
}

/**
 * Get the current attention state from Redis.
 */
export async function getAttentionState(): Promise<AttentionState | null> {
  return getValidatedRedis(KEYS.ATTENTION, AttentionState)
}

/**
 * Save the current attention state to Redis.
 */
export async function saveAttentionState(state: AttentionState): Promise<void> {
  await redis.set(KEYS.ATTENTION, state)
}
