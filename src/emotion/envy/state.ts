import { getValidatedRedis, redis } from "@/integrations/redis.ts"
import { DEFAULT_ENVY_STATE, EnvyState } from "./types.ts"

const REDIS_KEY = "working:emotion:envy"

export async function getEnvyState(): Promise<EnvyState> {
  const stored = await getValidatedRedis(REDIS_KEY, EnvyState)
  return stored ?? DEFAULT_ENVY_STATE
}

export async function saveEnvyState(state: EnvyState): Promise<void> {
  await redis.set(REDIS_KEY, state)
}
