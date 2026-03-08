import { getValidatedRedis, redis } from "@/integrations/redis.ts"
import { DEFAULT_RESENTMENT_STATE, ResentmentState } from "./types.ts"

const REDIS_KEY = "working:emotion:resentment"

export async function getResentmentState(): Promise<ResentmentState> {
  const stored = await getValidatedRedis(REDIS_KEY, ResentmentState)
  return stored ?? DEFAULT_RESENTMENT_STATE
}

export async function saveResentmentState(state: ResentmentState): Promise<void> {
  await redis.set(REDIS_KEY, state)
}
