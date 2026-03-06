import { redis } from "@/integrations/redis.ts"
import { AttentionState, InstinctImpression } from "./types.ts"

const KEYS = {
  INSTINCT: "working:cognition:instinct:lastImpression",
  ATTENTION: "working:cognition:attention"
} as const

/**
 * Get the last instinct impression from Redis.
 */
export async function getLastInstinctImpression(): Promise<InstinctImpression | null> {
  const raw = await redis.get(KEYS.INSTINCT)
  if (raw == null) return null
  const parsed = InstinctImpression.safeParse(typeof raw === "string" ? JSON.parse(raw) : raw)
  return parsed.success ? parsed.data : null
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
  const raw = await redis.get(KEYS.ATTENTION)
  if (raw == null) return null
  const parsed = AttentionState.safeParse(typeof raw === "string" ? JSON.parse(raw) : raw)
  return parsed.success ? parsed.data : null
}

/**
 * Save the current attention state to Redis.
 */
export async function saveAttentionState(state: AttentionState): Promise<void> {
  await redis.set(KEYS.ATTENTION, state)
}
