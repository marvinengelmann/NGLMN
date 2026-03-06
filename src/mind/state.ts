import { db } from "@/db/client.ts"
import { operatorModelLog } from "@/db/schema.ts"
import { redis } from "@/integrations/redis.ts"
import { DEFAULT_OPERATOR_MODEL, type ModelCorrection, OperatorModel } from "./types.ts"

const KEYS = {
  CURRENT: "working:mind:current",
  CORRECTIONS: "working:mind:corrections"
} as const

const MAX_CORRECTIONS = 20

/**
 * Get the current operator model from Redis.
 */
export async function getOperatorModel(): Promise<OperatorModel> {
  const raw = await redis.get(KEYS.CURRENT)
  if (raw == null) return DEFAULT_OPERATOR_MODEL
  try {
    const parsed = OperatorModel.safeParse(typeof raw === "string" ? JSON.parse(raw) : raw)
    return parsed.success ? parsed.data : DEFAULT_OPERATOR_MODEL
  } catch {
    return DEFAULT_OPERATOR_MODEL
  }
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
