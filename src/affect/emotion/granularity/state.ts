import { getValidatedRedis, redis } from "@/infra/integrations/redis.ts"
import type { WriteBuffer } from "@/infra/lib/buffer.ts"
import { DEFAULT_GRANULARITY_STATE, GranularityState } from "./types.ts"

const KEY = "working:emotion:granularity"

export async function getGranularityState(): Promise<GranularityState> {
  const fromRedis = await getValidatedRedis(KEY, GranularityState)
  return fromRedis ?? DEFAULT_GRANULARITY_STATE
}

export async function saveGranularityState(state: GranularityState, buffer?: WriteBuffer): Promise<void> {
  if (buffer) {
    buffer.stage(KEY, state)
  } else {
    await redis.set(KEY, state, { ex: 3600 })
  }
}
