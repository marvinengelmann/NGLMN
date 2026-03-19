import { getValidatedRedis, redis } from "@/infra/integrations/redis.ts"
import { DEFAULT_EMOTION_REGULATION_STATE, EmotionRegulationState } from "./types.ts"

const KEY = "working:regulation:state"

/**
 * Get current emotion regulation state from Redis.
 */
export async function getEmotionRegulationState(): Promise<EmotionRegulationState> {
  const fromRedis = await getValidatedRedis(KEY, EmotionRegulationState)
  return fromRedis ?? DEFAULT_EMOTION_REGULATION_STATE
}

/**
 * Save emotion regulation state to Redis.
 */
export async function saveEmotionRegulationState(state: EmotionRegulationState): Promise<void> {
  await redis.set(KEY, state, { ex: 3600 })
}
