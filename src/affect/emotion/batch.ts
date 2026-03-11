import { mgetValidatedRedis } from "@/infra/integrations/redis.ts"
import { getRegisteredEmotions } from "./registry.ts"
import type { SecondaryEmotionState } from "./types.ts"

/**
 * Load all registered secondary emotion states in a single Redis MGET call.
 * Returns a Map keyed by emotion name.
 */
export async function getAllSecondaryEmotionStates(): Promise<Map<string, SecondaryEmotionState>> {
  const emotions = getRegisteredEmotions()
  if (emotions.length === 0) return new Map()

  const entries = emotions.map((e) => ({
    key: e.redisKey,
    schema: e.schema,
    defaultValue: e.defaultState
  }))

  const values = await mgetValidatedRedis(entries)

  return emotions.reduce((result, emotion, i) => {
    const value = values[i]
    if (emotion && value) {
      result.set(emotion.name, value)
    }
    return result
  }, new Map<string, SecondaryEmotionState>())
}
