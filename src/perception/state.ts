import { getValidatedRedis, redis } from "@/infra/integrations/redis.ts"
import { OperatorLocation, WeatherData } from "@/infra/integrations/types.ts"
import { PERCEPTION } from "./constants.ts"
import type { PerceptionSummary } from "./types.ts"

const KEYS = {
  PERCEPTION_LATEST: "working:perception:latest",
  OPERATOR_LOCATION: "working:operator:location",
  OPERATOR_LAST_ACTIVITY: "working:operator:lastActivity",
  WEATHER_LATEST: "working:weather:latest"
} as const

const WEATHER_TTL_SECONDS = 1800

export async function setPerceptionSummary(summary: PerceptionSummary): Promise<void> {
  await redis.set(KEYS.PERCEPTION_LATEST, summary)
}

export async function getOperatorLocation(): Promise<OperatorLocation | null> {
  return getValidatedRedis(KEYS.OPERATOR_LOCATION, OperatorLocation)
}

export async function setOperatorLocation(
  location: OperatorLocation,
  ttlSeconds: number = PERCEPTION.OPERATOR_LOCATION_TTL_SECONDS
): Promise<void> {
  await redis.set(KEYS.OPERATOR_LOCATION, location, { ex: ttlSeconds })
}

export async function getOperatorLastActivity(): Promise<string | null> {
  return redis.get<string>(KEYS.OPERATOR_LAST_ACTIVITY)
}

export async function setOperatorLastActivity(isoTimestamp: string): Promise<void> {
  await redis.set(KEYS.OPERATOR_LAST_ACTIVITY, isoTimestamp)
}

export async function getWeatherData(): Promise<WeatherData | null> {
  return getValidatedRedis(KEYS.WEATHER_LATEST, WeatherData)
}

export async function setWeatherData(data: WeatherData): Promise<void> {
  await redis.set(KEYS.WEATHER_LATEST, data, { ex: WEATHER_TTL_SECONDS })
}

export async function clearWeatherData(): Promise<void> {
  await redis.del(KEYS.WEATHER_LATEST)
}

const SENSE_KEYS = {
  OPERATOR_SILENT_FIRED: "working:emotion:operatorSilentFired",
  LAST_SYSTEM_STATUS: "working:emotion:lastSystemStatus",
  LAST_WEATHER_CONDITION: "working:perception:lastWeatherCondition",
  LAST_GIT_COMMIT_SHA: "working:perception:lastGitCommitSha"
} as const

export async function getOperatorSilentFlag(): Promise<boolean> {
  const value = await redis.get(SENSE_KEYS.OPERATOR_SILENT_FIRED)
  return value === true || value === "true"
}

export async function setOperatorSilentFlag(): Promise<void> {
  await redis.set(SENSE_KEYS.OPERATOR_SILENT_FIRED, "true")
}

export async function clearOperatorSilentFlag(): Promise<void> {
  await redis.del(SENSE_KEYS.OPERATOR_SILENT_FIRED)
}

export async function getLastSystemStatus(): Promise<string | null> {
  return redis.get<string>(SENSE_KEYS.LAST_SYSTEM_STATUS)
}

export async function setLastSystemStatus(status: string): Promise<void> {
  await redis.set(SENSE_KEYS.LAST_SYSTEM_STATUS, status)
}

export async function getLastWeatherCondition(): Promise<string | null> {
  return redis.get<string>(SENSE_KEYS.LAST_WEATHER_CONDITION)
}

export async function setLastWeatherCondition(condition: string): Promise<void> {
  await redis.set(SENSE_KEYS.LAST_WEATHER_CONDITION, condition)
}

export async function getLastGitCommitSha(): Promise<string | null> {
  return redis.get<string>(SENSE_KEYS.LAST_GIT_COMMIT_SHA)
}

export async function setLastGitCommitSha(sha: string): Promise<void> {
  await redis.set(SENSE_KEYS.LAST_GIT_COMMIT_SHA, sha)
}
