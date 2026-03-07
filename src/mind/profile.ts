import { OPERATOR_PROFILE } from "@/config/constants.ts"
import { callIntelligence } from "@/core/intelligence.ts"
import { getValidatedRedisOr, redis } from "@/integrations/redis.ts"
import { log } from "@/lib/logger.ts"
import { nowISO } from "@/lib/time.ts"
import { CorrectionPattern, DEFAULT_OPERATOR_PROFILE, type MoodHistoryEntry, OperatorProfile } from "./types.ts"

const KEYS = {
  PROFILE: "working:mind:profile",
  CORRECTION_PATTERNS: "working:mind:correctionPatterns"
} as const

const PROFILE_UPDATE_PROMPT = `Analyze patterns in an operator's behavior across conversations.
Based on the conversation history, mood patterns, and correction data, update the operator profile.

Return a JSON object with:
- communicationStyle: brief description of how they communicate (e.g. "direct and concise", "emotional and expressive")
- knownPreferences: array of observed preferences (max 10)
- emotionalPatterns: description of their emotional tendencies
- recurringTopics: array of topics they frequently discuss (max 10)
- copingMechanisms: how they handle stress or difficulty
- unspokenNeeds: what they seem to need but don't explicitly ask for`

/**
 * Get the operator profile from Redis or return default.
 */
export async function getOperatorProfile(): Promise<OperatorProfile> {
  return getValidatedRedisOr(KEYS.PROFILE, OperatorProfile, DEFAULT_OPERATOR_PROFILE)
}

/**
 * Save the operator profile to Redis.
 */
export async function saveOperatorProfile(profile: OperatorProfile): Promise<void> {
  await redis.set(KEYS.PROFILE, profile)
}

/**
 * Update operator profile via LLM analysis of recent data.
 */
export async function updateOperatorProfile(
  current: OperatorProfile,
  recentConversations: string[],
  moodHistory: MoodHistoryEntry[],
  corrections: CorrectionPattern[]
): Promise<OperatorProfile> {
  const userMessage = [
    "Current profile:",
    JSON.stringify(current, null, 2),
    "",
    "Recent conversations:",
    ...recentConversations.slice(0, 5).map((c, i) => `  ${i + 1}. ${c}`),
    "",
    "Mood history:",
    ...moodHistory.map((m) => `  - ${m.mood} at ${m.timestamp}`),
    "",
    "Correction patterns:",
    ...corrections.map(
      (c) => `  - Signal: "${c.signal}" was misread as "${c.misinterpretation}", actually meant "${c.actualMeaning}"`
    )
  ].join("\n")

  const result = await callIntelligence({
    system: PROFILE_UPDATE_PROMPT,
    userMessage,
    schema: OperatorProfile.omit({ lastProfileUpdate: true }),
    maxTokens: 512,
    reasoning: false
  })

  if (result.isOk()) {
    const updated: OperatorProfile = {
      ...result.value,
      lastProfileUpdate: nowISO()
    }
    await saveOperatorProfile(updated)
    return updated
  }

  log.warn("Profile update LLM failed, keeping current", { error: result.error.message })
  return current
}

/**
 * Store a correction pattern when ANIMA misreads the operator.
 */
export async function storeCorrectionPattern(pattern: CorrectionPattern): Promise<void> {
  await redis.lpush(KEYS.CORRECTION_PATTERNS, JSON.stringify(pattern))
  await redis.ltrim(KEYS.CORRECTION_PATTERNS, 0, OPERATOR_PROFILE.MAX_CORRECTION_PATTERNS - 1)
}

/**
 * Get stored correction patterns.
 */
export async function getCorrectionPatterns(): Promise<CorrectionPattern[]> {
  const raw = await redis.lrange(KEYS.CORRECTION_PATTERNS, 0, -1)
  return raw
    .map((item) => {
      let value: unknown
      if (typeof item === "string") {
        try {
          value = JSON.parse(item)
        } catch {
          return null
        }
      } else {
        value = item
      }
      const parsed = CorrectionPattern.safeParse(value)
      return parsed.success ? parsed.data : null
    })
    .filter((p): p is CorrectionPattern => p !== null)
}
