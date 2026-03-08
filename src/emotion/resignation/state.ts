import { getValidatedRedis, redis } from "@/integrations/redis.ts"
import { DEFAULT_RESIGNATION_STATE, ResignationState } from "./types.ts"

const REDIS_KEY = "working:emotion:resignation"

export async function getResignationState(): Promise<ResignationState> {
  const stored = await getValidatedRedis(REDIS_KEY, ResignationState)
  return stored ?? DEFAULT_RESIGNATION_STATE
}

export async function saveResignationState(state: ResignationState): Promise<void> {
  await redis.set(REDIS_KEY, state)
}
