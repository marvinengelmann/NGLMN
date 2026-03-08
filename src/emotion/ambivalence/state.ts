import { getValidatedRedis, redis } from "@/integrations/redis.ts"
import { AmbivalenceState, DEFAULT_AMBIVALENCE_STATE } from "./types.ts"

const REDIS_KEY = "working:emotion:ambivalence"

export async function getAmbivalenceState(): Promise<AmbivalenceState> {
  const stored = await getValidatedRedis(REDIS_KEY, AmbivalenceState)
  return stored ?? DEFAULT_AMBIVALENCE_STATE
}

export async function saveAmbivalenceState(state: AmbivalenceState): Promise<void> {
  await redis.set(REDIS_KEY, state)
}
