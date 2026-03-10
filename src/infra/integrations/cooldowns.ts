import { parseISO } from "date-fns"
import { redis } from "@/infra/integrations/redis.ts"
import { CALENDAR, EMAIL, SOCIAL_MEDIA } from "./constants.ts"

const KEYS = {
  SOCIAL_LAST_BROWSE: "working:social:lastBrowse",
  SOCIAL_LAST_POST: "working:social:lastPost",
  EMAIL_LAST_CHECK: "working:email:lastCheck",
  CALENDAR_LAST_CHECK: "working:calendar:lastCheck"
} as const

export async function getSocialMediaLastBrowse(): Promise<string | null> {
  return redis.get<string>(KEYS.SOCIAL_LAST_BROWSE)
}

export async function setSocialMediaLastBrowse(isoTimestamp: string): Promise<void> {
  await redis.set(KEYS.SOCIAL_LAST_BROWSE, isoTimestamp)
}

export async function getSocialMediaLastPost(): Promise<string | null> {
  return redis.get<string>(KEYS.SOCIAL_LAST_POST)
}

export async function setSocialMediaLastPost(isoTimestamp: string): Promise<void> {
  await redis.set(KEYS.SOCIAL_LAST_POST, isoTimestamp)
}

/**
 * Check social media cooldowns for browse and post actions.
 */
export async function canPerformSocialMedia(): Promise<{ canBrowse: boolean; canPost: boolean }> {
  const now = Date.now()

  const [lastBrowse, lastPost] = await Promise.all([getSocialMediaLastBrowse(), getSocialMediaLastPost()])

  const canBrowse =
    !lastBrowse || now - parseISO(lastBrowse).getTime() > SOCIAL_MEDIA.BROWSE_COOLDOWN_MINUTES * 60 * 1000
  const canPost = !lastPost || now - parseISO(lastPost).getTime() > SOCIAL_MEDIA.POST_COOLDOWN_HOURS * 3600 * 1000

  return { canBrowse, canPost }
}

export async function getEmailLastCheck(): Promise<string | null> {
  return redis.get<string>(KEYS.EMAIL_LAST_CHECK)
}

export async function setEmailLastCheck(isoTimestamp: string): Promise<void> {
  await redis.set(KEYS.EMAIL_LAST_CHECK, isoTimestamp)
}

export async function canCheckEmail(): Promise<boolean> {
  const last = await getEmailLastCheck()
  return !last || Date.now() - parseISO(last).getTime() > EMAIL.CHECK_COOLDOWN_MINUTES * 60 * 1000
}

export async function getCalendarLastCheck(): Promise<string | null> {
  return redis.get<string>(KEYS.CALENDAR_LAST_CHECK)
}

export async function setCalendarLastCheck(isoTimestamp: string): Promise<void> {
  await redis.set(KEYS.CALENDAR_LAST_CHECK, isoTimestamp)
}

export async function canCheckCalendar(): Promise<boolean> {
  const last = await getCalendarLastCheck()
  return !last || Date.now() - parseISO(last).getTime() > CALENDAR.CHECK_COOLDOWN_MINUTES * 60 * 1000
}
