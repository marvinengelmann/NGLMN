import { getValidatedRedis, redis } from "@/infra/integrations/redis.ts"
import { DEFAULT_NEUROMODULATORY_STATE, NeuromodulatoryState } from "./types.ts"

const KEYS = {
  CURRENT: "working:affect:neuromodulation"
} as const

export async function getNeuromodulatoryState(): Promise<NeuromodulatoryState> {
  const fromRedis = await getValidatedRedis(KEYS.CURRENT, NeuromodulatoryState)
  return fromRedis ?? DEFAULT_NEUROMODULATORY_STATE
}

export async function saveNeuromodulatoryState(state: NeuromodulatoryState): Promise<void> {
  await redis.set(KEYS.CURRENT, state, { ex: 3600 })
}
