import * as z from "zod"
import { getValidatedRedis, redis } from "@/infra/integrations/redis.ts"
import { FEP } from "./constants.ts"
import { DEFAULT_FREE_ENERGY_STATE, FreeEnergyState } from "./types.ts"

const KEYS = {
  STATE: "working:fep:state",
  HISTORY: "working:fep:history"
} as const

export async function getFreeEnergyState(): Promise<FreeEnergyState> {
  const fromRedis = await getValidatedRedis(KEYS.STATE, FreeEnergyState)
  return fromRedis ?? DEFAULT_FREE_ENERGY_STATE
}

export async function saveFreeEnergyState(state: FreeEnergyState): Promise<void> {
  await redis.set(KEYS.STATE, JSON.stringify(state))
}

export async function getFreeEnergyHistory(): Promise<number[]> {
  const fromRedis = await getValidatedRedis(KEYS.HISTORY, z.array(z.number()))
  return fromRedis ?? []
}

export async function pushFreeEnergyHistory(totalFE: number): Promise<void> {
  const history = await getFreeEnergyHistory()
  history.push(totalFE)

  while (history.length > FEP.HISTORY_LENGTH) {
    history.shift()
  }

  await redis.set(KEYS.HISTORY, JSON.stringify(history))
}
