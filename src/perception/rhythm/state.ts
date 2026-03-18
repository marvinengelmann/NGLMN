import { getValidatedRedis, redis } from "@/infra/integrations/redis.ts"
import { DEFAULT_ULTRADIAN_STATE, UltradianState } from "./types.ts"

const KEY = "working:perception:ultradian"

export async function getUltradianState(): Promise<UltradianState> {
  const fromRedis = await getValidatedRedis(KEY, UltradianState)
  return fromRedis ?? DEFAULT_ULTRADIAN_STATE
}

export async function saveUltradianState(state: UltradianState): Promise<void> {
  await redis.set(KEY, state)
}
