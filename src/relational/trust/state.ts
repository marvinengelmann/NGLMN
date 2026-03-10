import { getValidatedRedisOr, redis } from "@/infra/integrations/redis.ts"
import type { ActionType, TrustEvent } from "./types.ts"
import { TrustEventLog } from "./types.ts"

const KEYS = {
  trustLevel: (actionType: string) => `working:trust:${actionType}` as const
} as const

export async function getTrustEventLog(actionType: ActionType): Promise<TrustEvent[]> {
  return getValidatedRedisOr(KEYS.trustLevel(actionType), TrustEventLog, [])
}

export async function setTrustEventLog(actionType: ActionType, events: TrustEvent[]): Promise<void> {
  const capped = events.slice(-100)
  await redis.set(KEYS.trustLevel(actionType), capped)
}

export async function pushTrustEvent(actionType: ActionType, event: TrustEvent): Promise<void> {
  const events = await getTrustEventLog(actionType)
  events.push(event)
  await setTrustEventLog(actionType, events)
}
