import { getValidatedRedisOr, redis } from "@/infra/integrations/redis.ts"
import { OPERATOR_PROFILE } from "./constants.ts"
import { type CorrectionPattern, DEFAULT_OPERATOR_PROFILE, OperatorProfile } from "./types.ts"

const KEYS = {
  PROFILE: "working:mind:profile",
  CORRECTION_PATTERNS: "working:mind:correctionPatterns"
} as const

/**
 * Get the operator profile from Redis or return default.
 */
export async function getOperatorProfile(): Promise<OperatorProfile> {
  return getValidatedRedisOr(KEYS.PROFILE, OperatorProfile, DEFAULT_OPERATOR_PROFILE)
}

/**
 * Store a correction pattern when ANIMA misreads the operator.
 */
export async function storeCorrectionPattern(pattern: CorrectionPattern): Promise<void> {
  await redis.lpush(KEYS.CORRECTION_PATTERNS, JSON.stringify(pattern))
  await redis.ltrim(KEYS.CORRECTION_PATTERNS, 0, OPERATOR_PROFILE.MAX_CORRECTION_PATTERNS - 1)
}
