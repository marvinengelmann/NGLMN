import { getValidatedRedis, redis } from "@/integrations/redis.ts"
import { DEFAULT_HOPE_STATE, HopeState } from "./types.ts"

const REDIS_KEY = "working:emotion:hope"

export async function getHopeState(): Promise<HopeState> {
  const stored = await getValidatedRedis(REDIS_KEY, HopeState)
  return stored ?? DEFAULT_HOPE_STATE
}

export async function saveHopeState(state: HopeState): Promise<void> {
  await redis.set(REDIS_KEY, state)
}
