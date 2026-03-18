import { getValidatedRedis, redis } from "@/infra/integrations/redis.ts"
import type { WriteBuffer } from "@/infra/lib/buffer.ts"
import { DEFAULT_DISSOCIATIVE_STATE, DissociativeState } from "./types.ts"

const KEY = "working:coherence:dissociation"

export async function getDissociativeState(): Promise<DissociativeState> {
  const fromRedis = await getValidatedRedis(KEY, DissociativeState)
  return fromRedis ?? DEFAULT_DISSOCIATIVE_STATE
}

export async function saveDissociativeState(state: DissociativeState, buffer?: WriteBuffer): Promise<void> {
  if (buffer) {
    buffer.stage(KEY, state)
  } else {
    await redis.set(KEY, state)
  }
}
