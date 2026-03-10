import { mgetValidatedRedis, redis } from "@/integrations/redis.ts"
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

  const result = new Map<string, SecondaryEmotionState>()
  for (let i = 0; i < emotions.length; i++) {
    const emotion = emotions[i]
    const value = values[i]
    if (emotion && value) {
      result.set(emotion.name, value)
    }
  }
  return result
}

/**
 * Save all secondary emotion states in a single Redis pipeline roundtrip.
 */
export async function saveAllSecondaryEmotionStates(states: Map<string, SecondaryEmotionState>): Promise<void> {
  if (states.size === 0) return

  const emotions = getRegisteredEmotions()
  const pipe = redis.pipeline()

  for (const entry of emotions) {
    const state = states.get(entry.name)
    if (state) {
      pipe.set(entry.redisKey, state)
    }
  }

  await pipe.exec()
}
