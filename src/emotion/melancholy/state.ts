import { getValidatedRedis, redis } from "@/integrations/redis.ts"
import { DEFAULT_MELANCHOLY_STATE, MelancholyState } from "./types.ts"

const REDIS_KEY = "working:emotion:melancholy"

export async function getMelancholyState(): Promise<MelancholyState> {
  const stored = await getValidatedRedis(REDIS_KEY, MelancholyState)
  return stored ?? DEFAULT_MELANCHOLY_STATE
}

export async function saveMelancholyState(state: MelancholyState): Promise<void> {
  await redis.set(REDIS_KEY, state)
}
