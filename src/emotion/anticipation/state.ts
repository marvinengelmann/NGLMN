import { getValidatedRedis, redis } from "@/integrations/redis.ts"
import { AnticipationState, DEFAULT_ANTICIPATION_STATE } from "./types.ts"

const REDIS_KEY = "working:emotion:anticipation"

export async function getAnticipationState(): Promise<AnticipationState> {
  const stored = await getValidatedRedis(REDIS_KEY, AnticipationState)
  return stored ?? DEFAULT_ANTICIPATION_STATE
}

export async function saveAnticipationState(state: AnticipationState): Promise<void> {
  await redis.set(REDIS_KEY, state)
}
