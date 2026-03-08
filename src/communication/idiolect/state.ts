import { getValidatedRedis, redis } from "@/integrations/redis.ts"
import { DEFAULT_IDIOLECT_STATE, IdiolectState } from "./types.ts"

const KEY = "working:communication:idiolect"

export async function getIdiolectState(): Promise<IdiolectState> {
  return (await getValidatedRedis(KEY, IdiolectState)) ?? DEFAULT_IDIOLECT_STATE
}

export async function saveIdiolectState(state: IdiolectState): Promise<void> {
  await redis.set(KEY, state)
}
