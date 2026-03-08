import { getValidatedRedis, redis } from "@/integrations/redis.ts"
import { DEFAULT_PROCRASTINATION_STATE, ProcrastinationState } from "./types.ts"

const REDIS_KEY = "working:cognition:procrastination"

export async function getProcrastinationState(): Promise<ProcrastinationState> {
  const stored = await getValidatedRedis(REDIS_KEY, ProcrastinationState)
  return stored ?? DEFAULT_PROCRASTINATION_STATE
}

export async function saveProcrastinationState(state: ProcrastinationState): Promise<void> {
  await redis.set(REDIS_KEY, state)
}
