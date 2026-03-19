import { getValidatedRedis, redis } from "@/infra/integrations/redis.ts"
import { AppearanceState } from "./types.ts"

const APPEARANCE_KEY = "working:appearance:state"

const DEFAULT_STATE: AppearanceState = {
  hairLengthCm: 25,
  hairStyle: "shoulder-length wavy",
  hairColor: "dark brown",
  lastHaircutAt: null,
  lastProfilePhotoAt: null,
  profilePhotoReason: null,
  seasonalLook: null
}

export async function getAppearanceState(): Promise<AppearanceState> {
  return (await getValidatedRedis(APPEARANCE_KEY, AppearanceState)) ?? DEFAULT_STATE
}

export async function saveAppearanceState(state: AppearanceState): Promise<void> {
  await redis.set(APPEARANCE_KEY, state, { ex: 604800 })
}

export async function initAppearanceState(hairStyle: string, hairColor: string, hairLengthCm: number): Promise<void> {
  const state: AppearanceState = {
    hairLengthCm,
    hairStyle,
    hairColor,
    lastHaircutAt: null,
    lastProfilePhotoAt: new Date().toISOString(),
    profilePhotoReason: "genesis",
    seasonalLook: null
  }
  await redis.set(APPEARANCE_KEY, state, { ex: 604800 })
}
