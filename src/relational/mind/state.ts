import { db } from "@/infra/db/client.ts"
import { operatorModelLog } from "@/infra/db/schema.ts"
import { getValidatedRedisOr, redis } from "@/infra/integrations/redis.ts"
import {
  DEFAULT_OPERATOR_MODEL,
  DEFAULT_RELATIONAL_PATTERN_LIBRARY,
  type ModelCorrection,
  OperatorModel,
  RelationalPatternLibrary
} from "./types.ts"

const KEYS = {
  CURRENT: "working:mind:current",
  CORRECTIONS: "working:mind:corrections",
  RELATIONAL_PATTERNS: "working:mind:relational_patterns"
} as const

const MAX_CORRECTIONS = 20

/**
 * Get the current operator model from Redis.
 */
export async function getOperatorModel(): Promise<OperatorModel> {
  return getValidatedRedisOr(KEYS.CURRENT, OperatorModel, DEFAULT_OPERATOR_MODEL)
}

/**
 * Save the operator model to Redis and log to DB.
 */
export async function saveOperatorModel(model: OperatorModel, trigger: string): Promise<void> {
  await redis.set(KEYS.CURRENT, model)
  await db.insert(operatorModelLog).values({
    model,
    trigger
  })
}

/**
 * Log a model correction to Redis list and DB.
 */
export async function logModelCorrection(correction: ModelCorrection): Promise<void> {
  await redis.lpush(KEYS.CORRECTIONS, JSON.stringify(correction))
  await redis.ltrim(KEYS.CORRECTIONS, 0, MAX_CORRECTIONS - 1)
  await db.insert(operatorModelLog).values({
    model: null,
    trigger: "correction",
    correction
  })
}

/**
 * Get the learned relational pattern library from Redis.
 */
export async function getRelationalPatterns(): Promise<RelationalPatternLibrary> {
  return getValidatedRedisOr(KEYS.RELATIONAL_PATTERNS, RelationalPatternLibrary, DEFAULT_RELATIONAL_PATTERN_LIBRARY)
}

/**
 * Save the relational pattern library to Redis.
 */
export async function saveRelationalPatterns(library: RelationalPatternLibrary): Promise<void> {
  await redis.set(KEYS.RELATIONAL_PATTERNS, library)
}
