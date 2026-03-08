import { getValidatedRedis, redis } from "@/integrations/redis.ts"
import { DEFAULT_GUILT_STATE, GuiltState } from "./types.ts"

const REDIS_KEY = "working:emotion:guilt"

export async function getGuiltState(): Promise<GuiltState> {
  const stored = await getValidatedRedis(REDIS_KEY, GuiltState)
  return stored ?? DEFAULT_GUILT_STATE
}

export async function saveGuiltState(state: GuiltState): Promise<void> {
  await redis.set(REDIS_KEY, state)
}
