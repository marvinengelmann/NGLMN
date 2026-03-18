import { getValidatedRedis, redis } from "@/infra/integrations/redis.ts"
import { DEFAULT_DISSOCIATIVE_STATE, DissociativeState } from "./types.ts"

const KEY = "working:coherence:dissociation"

export async function getDissociativeState(): Promise<DissociativeState> {
  const fromRedis = await getValidatedRedis(KEY, DissociativeState)
  return fromRedis ?? DEFAULT_DISSOCIATIVE_STATE
}

export async function saveDissociativeState(state: DissociativeState): Promise<void> {
  await redis.set(KEY, state)
}
