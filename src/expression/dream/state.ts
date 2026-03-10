import { getValidatedRedis, redis } from "@/infra/integrations/redis.ts"
import { DREAM_AFTERGLOW } from "./constants.ts"
import { DreamAfterglow, DreamState } from "./types.ts"

const KEYS = {
  DREAM_STATE: "working:dream:state",
  DREAM_LAST_RUN: "working:dream:lastRun",
  DREAM_INSIGHTS: "working:dream:insights",
  DREAM_NARRATIVE: "working:dream:narrative",
  DREAM_AFTERGLOW: "working:dream:afterglow"
} as const

export async function getDreamState(): Promise<DreamState> {
  const value = await redis.get<string>(KEYS.DREAM_STATE)
  const parsed = DreamState.safeParse(value)
  return parsed.success ? parsed.data : "idle"
}

export async function setDreamState(state: DreamState): Promise<void> {
  await redis.set(KEYS.DREAM_STATE, state)
}

export async function getDreamLastRun(): Promise<string | null> {
  return redis.get<string>(KEYS.DREAM_LAST_RUN)
}

export async function setDreamLastRun(isoTimestamp: string): Promise<void> {
  await redis.set(KEYS.DREAM_LAST_RUN, isoTimestamp)
}

export async function getDreamInsights(): Promise<string[] | null> {
  return redis.get<string[]>(KEYS.DREAM_INSIGHTS)
}

export async function setDreamInsights(insights: string[]): Promise<void> {
  await redis.set(KEYS.DREAM_INSIGHTS, insights)
}

export async function clearDreamInsights(): Promise<void> {
  await redis.del(KEYS.DREAM_INSIGHTS)
}

export async function getDreamNarrative(): Promise<string | null> {
  return redis.get<string>(KEYS.DREAM_NARRATIVE)
}

export async function setDreamNarrative(narrative: string): Promise<void> {
  await redis.set(KEYS.DREAM_NARRATIVE, narrative)
}

export async function clearDreamNarrative(): Promise<void> {
  await redis.del(KEYS.DREAM_NARRATIVE)
}

export async function getDreamAfterglow(): Promise<DreamAfterglow | null> {
  return getValidatedRedis(KEYS.DREAM_AFTERGLOW, DreamAfterglow)
}

export async function saveDreamAfterglow(afterglow: DreamAfterglow): Promise<void> {
  await redis.set(KEYS.DREAM_AFTERGLOW, afterglow, { ex: DREAM_AFTERGLOW.TTL_SECONDS })
}

export async function clearDreamAfterglow(): Promise<void> {
  await redis.del(KEYS.DREAM_AFTERGLOW)
}
