import { getValidatedRedis, redis } from "@/infra/integrations/redis.ts"
import { HealthCheckResult } from "./types.ts"

const KEYS = {
  HEALTH_LAST_CHECK: "working:health:lastCheck",
  HEALTH_LAST_HEALTHY_COMMIT: "working:health:lastHealthyCommit",
  CONSECUTIVE_CRITICAL: "working:health:consecutiveCritical"
} as const

export async function setHealthCheck(result: HealthCheckResult): Promise<void> {
  await redis.set(KEYS.HEALTH_LAST_CHECK, result, { ex: 3600 })
}

export async function getHealthCheck(): Promise<HealthCheckResult | null> {
  return getValidatedRedis(KEYS.HEALTH_LAST_CHECK, HealthCheckResult)
}

export async function pingRedis(): Promise<boolean> {
  try {
    const result = await redis.ping()
    return result === "PONG"
  } catch {
    return false
  }
}

export async function getLastHealthyCommit(): Promise<string | null> {
  return redis.get<string>(KEYS.HEALTH_LAST_HEALTHY_COMMIT)
}

export async function setLastHealthyCommit(sha: string): Promise<void> {
  await redis.set(KEYS.HEALTH_LAST_HEALTHY_COMMIT, sha, { ex: 604800 })
}

export async function incrementConsecutiveCritical(): Promise<number> {
  return redis.incr(KEYS.CONSECUTIVE_CRITICAL)
}

export async function resetConsecutiveCritical(): Promise<void> {
  await redis.del(KEYS.CONSECUTIVE_CRITICAL)
}

export async function getConsecutiveCritical(): Promise<number> {
  return (await redis.get<number>(KEYS.CONSECUTIVE_CRITICAL)) ?? 0
}
