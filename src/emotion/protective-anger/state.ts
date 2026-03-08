import { getValidatedRedis, redis } from "@/integrations/redis.ts"
import { DEFAULT_PROTECTIVE_ANGER_STATE, ProtectiveAngerState } from "./types.ts"

const REDIS_KEY = "working:emotion:protective-anger"

export async function getProtectiveAngerState(): Promise<ProtectiveAngerState> {
  const stored = await getValidatedRedis(REDIS_KEY, ProtectiveAngerState)
  return stored ?? DEFAULT_PROTECTIVE_ANGER_STATE
}

export async function saveProtectiveAngerState(state: ProtectiveAngerState): Promise<void> {
  await redis.set(REDIS_KEY, state)
}
