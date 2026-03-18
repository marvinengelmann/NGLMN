import { getValidatedRedis, redis } from "@/infra/integrations/redis.ts"
import { DEFAULT_FORECASTING_STATE, ForecastingState } from "./types.ts"

const KEY = "working:cognition:forecasting"

export async function getForecastingState(): Promise<ForecastingState> {
  const fromRedis = await getValidatedRedis(KEY, ForecastingState)
  return fromRedis ?? DEFAULT_FORECASTING_STATE
}

export async function saveForecastingState(state: ForecastingState): Promise<void> {
  await redis.set(KEY, state)
}
