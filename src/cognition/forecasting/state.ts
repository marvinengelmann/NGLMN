import { getValidatedRedis, redis } from "@/infra/integrations/redis.ts"
import type { WriteBuffer } from "@/infra/lib/buffer.ts"
import { DEFAULT_FORECASTING_STATE, ForecastingState } from "./types.ts"

const KEY = "working:cognition:forecasting"

export async function getForecastingState(): Promise<ForecastingState> {
  const fromRedis = await getValidatedRedis(KEY, ForecastingState)
  return fromRedis ?? DEFAULT_FORECASTING_STATE
}

export async function saveForecastingState(state: ForecastingState, buffer?: WriteBuffer): Promise<void> {
  if (buffer) {
    buffer.stage(KEY, state)
  } else {
    await redis.set(KEY, state, { ex: 3600 })
  }
}
