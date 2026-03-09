import { getValidatedRedis, redis } from "@/integrations/redis.ts"
import { HealthCheckResult } from "./types.ts"

const KEYS = {
  HEALTH_LAST_CHECK: "working:health:lastCheck",
  HEALTH_LAST_HEALTHY_COMMIT: "working:health:lastHealthyCommit"
} as const

export async function setHealthCheck(result: HealthCheckResult): Promise<void> {
  await redis.set(KEYS.HEALTH_LAST_CHECK, result)
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
  await redis.set(KEYS.HEALTH_LAST_HEALTHY_COMMIT, sha)
}
