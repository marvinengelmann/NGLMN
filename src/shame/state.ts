import { getValidatedRedis, redis } from "@/integrations/redis.ts"
import { DEFAULT_SHAME_STATE, ShameState } from "./types.ts"

const KEY = "working:shame:state"

export async function getShameState(): Promise<ShameState> {
  return (await getValidatedRedis(KEY, ShameState)) ?? DEFAULT_SHAME_STATE
}

export async function saveShameState(state: ShameState): Promise<void> {
  await redis.set(KEY, state)
}
