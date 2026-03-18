import * as z from "zod"
import { getValidatedRedis, redis } from "@/infra/integrations/redis.ts"
import type { WriteBuffer } from "@/infra/lib/buffer.ts"
import { FEP } from "./constants.ts"
import { DEFAULT_FREE_ENERGY_STATE, FreeEnergyState } from "./types.ts"

const KEYS = {
  STATE: "working:fep:state",
  HISTORY: "working:fep:history",
  PRIOR_EMOTION: "working:fep:prior_emotion",
  PRIOR_SOMA: "working:fep:prior_soma"
} as const

export async function getFreeEnergyState(): Promise<FreeEnergyState> {
  const fromRedis = await getValidatedRedis(KEYS.STATE, FreeEnergyState)
  return fromRedis ?? DEFAULT_FREE_ENERGY_STATE
}

export async function saveFreeEnergyState(state: FreeEnergyState, buffer?: WriteBuffer): Promise<void> {
  if (buffer) {
    buffer.stage(KEYS.STATE, state)
  } else {
    await redis.set(KEYS.STATE, JSON.stringify(state))
  }
}

export async function getFreeEnergyHistory(): Promise<number[]> {
  const fromRedis = await getValidatedRedis(KEYS.HISTORY, z.array(z.number()))
  return fromRedis ?? []
}

export async function pushFreeEnergyHistory(totalFE: number, buffer?: WriteBuffer): Promise<void> {
  const history = await getFreeEnergyHistory()
  history.push(totalFE)

  while (history.length > FEP.HISTORY_LENGTH) {
    history.shift()
  }

  if (buffer) {
    buffer.stage(KEYS.HISTORY, history)
  } else {
    await redis.set(KEYS.HISTORY, JSON.stringify(history))
  }
}

export async function getPriorSnapshots(): Promise<{
  emotion: Record<string, number> | null
  soma: Record<string, number> | null
}> {
  const emotionRaw = await getValidatedRedis(KEYS.PRIOR_EMOTION, z.record(z.string(), z.number()))
  const somaRaw = await getValidatedRedis(KEYS.PRIOR_SOMA, z.record(z.string(), z.number()))
  return { emotion: emotionRaw, soma: somaRaw }
}

export async function savePriorSnapshots(emotion: Record<string, number>, soma: Record<string, number>): Promise<void> {
  await Promise.all([
    redis.set(KEYS.PRIOR_EMOTION, JSON.stringify(emotion)),
    redis.set(KEYS.PRIOR_SOMA, JSON.stringify(soma))
  ])
}
