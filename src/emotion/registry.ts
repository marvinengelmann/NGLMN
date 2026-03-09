import type * as z from "zod"
import { getValidatedRedis, redis } from "@/integrations/redis.ts"
import type { EmotionalState } from "./types.ts"

export function createStateManager<S>(redisKey: string, schema: z.ZodType<S>, defaultState: S) {
  return {
    get: async (): Promise<S> => {
      const stored = await getValidatedRedis(redisKey, schema)
      return stored ?? defaultState
    },
    save: async (state: S): Promise<void> => {
      await redis.set(redisKey, state)
    }
  }
}

export function applyEffect(
  emotion: EmotionalState,
  effect: Partial<Record<keyof EmotionalState, number>>
): EmotionalState {
  let result = emotion
  for (const [dim, delta] of Object.entries(effect)) {
    const key = dim as keyof EmotionalState
    if (key in result) {
      result = { ...result, [key]: Math.max(0, Math.min(1, result[key] + delta)) }
    }
  }
  return result
}
