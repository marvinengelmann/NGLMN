import type * as z from "zod"
import type { WriteBuffer } from "@/consciousness/pipeline/persistence.ts"
import { getValidatedRedis, redis } from "@/infra/integrations/redis.ts"

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

export function createDeferredStateManager<S>(redisKey: string, schema: z.ZodType<S>, defaultState: S) {
  const base = createStateManager(redisKey, schema, defaultState)
  return {
    ...base,
    saveDeferred: (state: S, buffer: WriteBuffer): void => {
      buffer.stage(redisKey, state)
    }
  }
}
