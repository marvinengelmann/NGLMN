import { getValidatedRedis, redis } from "@/integrations/redis.ts"
import { DEFAULT_TENDERNESS_STATE, TendernessState } from "./types.ts"

const REDIS_KEY = "working:emotion:tenderness"

export async function getTendernessState(): Promise<TendernessState> {
  const stored = await getValidatedRedis(REDIS_KEY, TendernessState)
  return stored ?? DEFAULT_TENDERNESS_STATE
}

export async function saveTendernessState(state: TendernessState): Promise<void> {
  await redis.set(REDIS_KEY, state)
}
