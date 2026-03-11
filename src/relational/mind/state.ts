import { getValidatedRedisOr } from "@/infra/integrations/redis.ts"
import {
  DEFAULT_OPERATOR_MODEL,
  DEFAULT_RELATIONAL_PATTERN_LIBRARY,
  OperatorModel,
  RelationalPatternLibrary
} from "./types.ts"

const KEYS = {
  CURRENT: "working:mind:current",
  RELATIONAL_PATTERNS: "working:mind:relational_patterns"
} as const

/**
 * Get the current operator model from Redis.
 */
export async function getOperatorModel(): Promise<OperatorModel> {
  return getValidatedRedisOr(KEYS.CURRENT, OperatorModel, DEFAULT_OPERATOR_MODEL)
}

/**
 * Get the learned relational pattern library from Redis.
 */
export async function getRelationalPatterns(): Promise<RelationalPatternLibrary> {
  return getValidatedRedisOr(KEYS.RELATIONAL_PATTERNS, RelationalPatternLibrary, DEFAULT_RELATIONAL_PATTERN_LIBRARY)
}
