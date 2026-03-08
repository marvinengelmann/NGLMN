import { getValidatedRedis, redis } from "@/integrations/redis.ts"
import { AweState, DEFAULT_AWE_STATE } from "./types.ts"

const REDIS_KEY = "working:emotion:awe"

export async function getAweState(): Promise<AweState> {
  const stored = await getValidatedRedis(REDIS_KEY, AweState)
  return stored ?? DEFAULT_AWE_STATE
}

export async function saveAweState(state: AweState): Promise<void> {
  await redis.set(REDIS_KEY, state)
}
