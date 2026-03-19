import { differenceInDays, getMonth, parseISO } from "date-fns"
import type { AppearanceState } from "./types.ts"

const HAIR_GROWTH_CM_PER_DAY = 0.033

const MINIMUM_PROFILE_PHOTO_COOLDOWN_DAYS = 21
const SPONTANEOUS_UPDATE_MIN_DAYS = 42
const SEASONAL_UPDATE_MIN_DAYS = 28

type ProfilePhotoReason = "haircut" | "spontaneous" | "seasonal"

export function growHair(state: AppearanceState, daysSinceLastTick: number): AppearanceState {
  const growth = HAIR_GROWTH_CM_PER_DAY * Math.max(0, daysSinceLastTick)
  return { ...state, hairLengthCm: state.hairLengthCm + growth }
}

export function evaluateProfilePhotoTrigger(
  state: AppearanceState,
  recentlyCompletedHaircut: boolean
): ProfilePhotoReason | null {
  const daysSinceLastPhoto = state.lastProfilePhotoAt
    ? differenceInDays(new Date(), parseISO(state.lastProfilePhotoAt))
    : 999

  if (daysSinceLastPhoto < MINIMUM_PROFILE_PHOTO_COOLDOWN_DAYS) return null

  if (recentlyCompletedHaircut) return "haircut"

  if (daysSinceLastPhoto >= SPONTANEOUS_UPDATE_MIN_DAYS) return "spontaneous"

  const lastPhotoSeason = state.lastProfilePhotoAt ? getSeason(parseISO(state.lastProfilePhotoAt)) : null
  const currentSeason = getSeason(new Date())
  if (lastPhotoSeason !== currentSeason && daysSinceLastPhoto >= SEASONAL_UPDATE_MIN_DAYS) return "seasonal"

  return null
}

export function describeHairLength(cm: number): string {
  if (cm < 5) return "very short pixie-cut"
  if (cm < 10) return "short"
  if (cm < 20) return "chin-length"
  if (cm < 30) return "shoulder-length"
  if (cm < 45) return "long"
  return "very long"
}

export function computePostHaircutLength(currentCm: number): number {
  const minKeep = 0.35
  const maxKeep = 0.65
  const keepRatio = minKeep + Math.random() * (maxKeep - minKeep)
  return Math.max(5, currentCm * keepRatio)
}

export function buildDynamicAppearance(genesisAppearance: string, state: AppearanceState): string {
  const lengthDesc = describeHairLength(state.hairLengthCm)
  const dynamicHairDesc = `${lengthDesc} ${state.hairStyle} ${state.hairColor} hair`

  const hairPatterns = [
    /(?:very\s+)?(?:short|long|chin-length|shoulder-length|medium-length|waist-length)\s+[\w\s,-]*hair/i,
    /hair\s+[\w\s]*(?:reaching|past|above|below|to)\s+[\w\s]+/i,
    /[\w\s,-]*hair\s+(?:that\s+)?(?:is\s+)?(?:very\s+)?(?:short|long|chin-length|shoulder-length)/i
  ]

  for (const pattern of hairPatterns) {
    if (pattern.test(genesisAppearance)) {
      return genesisAppearance.replace(pattern, dynamicHairDesc)
    }
  }

  return `${genesisAppearance} Current hair: ${dynamicHairDesc}.`
}

function getSeason(date: Date): "spring" | "summer" | "autumn" | "winter" {
  const month = getMonth(date)
  if (month >= 2 && month <= 4) return "spring"
  if (month >= 5 && month <= 7) return "summer"
  if (month >= 8 && month <= 10) return "autumn"
  return "winter"
}
