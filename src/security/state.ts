import { getValidatedRedis, redis } from "@/integrations/redis.ts"
import { GuardianResult } from "./types.ts"

const KEYS = {
  GUARDIAN_LAST_RESULT: "working:guardian:lastResult",
  GUARDIAN_RECENT_RESPONSES: "working:guardian:recentResponses"
} as const

export async function setGuardianResult(result: GuardianResult): Promise<void> {
  await redis.set(KEYS.GUARDIAN_LAST_RESULT, result)
}

export async function getGuardianResult(): Promise<GuardianResult | null> {
  return getValidatedRedis(KEYS.GUARDIAN_LAST_RESULT, GuardianResult)
}

export async function pushRecentResponse(text: string): Promise<void> {
  await redis.lpush(KEYS.GUARDIAN_RECENT_RESPONSES, text)
  await redis.ltrim(KEYS.GUARDIAN_RECENT_RESPONSES, 0, 9)
}

export async function getRecentResponses(): Promise<string[]> {
  const raw = await redis.lrange(KEYS.GUARDIAN_RECENT_RESPONSES, 0, -1)
  return raw.map(String)
}
