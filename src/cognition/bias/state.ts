import { getValidatedRedis, redis } from "@/infra/integrations/redis.ts"
import { BiasState, DEFAULT_BIAS_STATE } from "./types.ts"

const KEY = "working:cognition:bias"

/**
 * Get current cognitive bias state from Redis.
 */
export async function getBiasState(): Promise<BiasState> {
  const fromRedis = await getValidatedRedis(KEY, BiasState)
  return fromRedis ?? DEFAULT_BIAS_STATE
}

/**
 * Save cognitive bias state to Redis.
 */
export async function saveBiasState(state: BiasState): Promise<void> {
  await redis.set(KEY, state)
}
