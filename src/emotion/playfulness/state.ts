import { getValidatedRedis, redis } from "@/integrations/redis.ts"
import { DEFAULT_PLAYFULNESS_STATE, PlayfulnessState } from "./types.ts"

const REDIS_KEY = "working:emotion:playfulness"

export async function getPlayfulnessState(): Promise<PlayfulnessState> {
  const stored = await getValidatedRedis(REDIS_KEY, PlayfulnessState)
  return stored ?? DEFAULT_PLAYFULNESS_STATE
}

export async function savePlayfulnessState(state: PlayfulnessState): Promise<void> {
  await redis.set(REDIS_KEY, state)
}
