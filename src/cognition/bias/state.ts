import { getValidatedRedis, redis } from "@/infra/integrations/redis.ts"
import type { WriteBuffer } from "@/infra/lib/buffer.ts"
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
 * Save cognitive bias state to Redis, or stage it in the buffer for atomic flush.
 */
export async function saveBiasState(state: BiasState, buffer?: WriteBuffer): Promise<void> {
  if (buffer) {
    buffer.stage(KEY, state)
  } else {
    await redis.set(KEY, state, { ex: 3600 })
  }
}
