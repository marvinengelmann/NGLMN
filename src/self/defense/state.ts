import { getValidatedRedis, redis } from "@/infra/integrations/redis.ts"
import { DEFAULT_DEFENSE_STATE, DefenseState } from "./types.ts"

const KEY = "working:defense:state"

/**
 * Get current defense mechanism state from Redis.
 */
export async function getDefenseState(): Promise<DefenseState> {
  const fromRedis = await getValidatedRedis(KEY, DefenseState)
  return fromRedis ?? DEFAULT_DEFENSE_STATE
}

/**
 * Save defense mechanism state to Redis.
 */
export async function saveDefenseState(state: DefenseState): Promise<void> {
  await redis.set(KEY, state)
}
