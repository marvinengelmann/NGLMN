import { getValidatedRedis, redis } from "@/integrations/redis.ts"
import { DEFAULT_GRATITUDE_STATE, GratitudeState } from "./types.ts"

const REDIS_KEY = "working:emotion:gratitude"

export async function getGratitudeState(): Promise<GratitudeState> {
  const stored = await getValidatedRedis(REDIS_KEY, GratitudeState)
  return stored ?? DEFAULT_GRATITUDE_STATE
}

export async function saveGratitudeState(state: GratitudeState): Promise<void> {
  await redis.set(REDIS_KEY, state)
}
