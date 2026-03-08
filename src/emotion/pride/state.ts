import { getValidatedRedis, redis } from "@/integrations/redis.ts"
import { DEFAULT_PRIDE_STATE, PrideState } from "./types.ts"

const REDIS_KEY = "working:emotion:pride"

export async function getPrideState(): Promise<PrideState> {
  const stored = await getValidatedRedis(REDIS_KEY, PrideState)
  return stored ?? DEFAULT_PRIDE_STATE
}

export async function savePrideState(state: PrideState): Promise<void> {
  await redis.set(REDIS_KEY, state)
}
