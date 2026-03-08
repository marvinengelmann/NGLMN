import { getValidatedRedis, redis } from "@/integrations/redis.ts"
import { DEFAULT_LONGING_STATE, LongingState } from "./types.ts"

const REDIS_KEY = "working:emotion:longing"

export async function getLongingState(): Promise<LongingState> {
  const stored = await getValidatedRedis(REDIS_KEY, LongingState)
  return stored ?? DEFAULT_LONGING_STATE
}

export async function saveLongingState(state: LongingState): Promise<void> {
  await redis.set(REDIS_KEY, state)
}
