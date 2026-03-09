import type * as z from "zod"
import { getValidatedRedis, redis } from "@/integrations/redis.ts"

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
