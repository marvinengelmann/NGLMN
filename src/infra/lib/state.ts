import type * as z from "zod"
import { getValidatedRedis, redis } from "@/infra/integrations/redis.ts"
import type { WriteBuffer } from "@/infra/lib/buffer.ts"

export function createStateManager<S>(redisKey: string, schema: z.ZodType<S>, defaultState: S) {
  return {
    get: async (): Promise<S> => {
      const stored = await getValidatedRedis(redisKey, schema)
      return stored ?? defaultState
    },
    save: async (state: S, buffer?: WriteBuffer): Promise<void> => {
      if (buffer) {
        buffer.stage(redisKey, state)
      } else {
        await redis.set(redisKey, state)
      }
    }
  }
}
