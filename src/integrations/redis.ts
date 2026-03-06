import { Redis } from "@upstash/redis"
import type { ZodType } from "zod"
import { log } from "@/lib/logger.ts"

export const redis = Redis.fromEnv()

/**
 * Parse a raw Redis value against a Zod schema with JSON deserialization.
 * Returns null (with a warning log) on parse or validation failure instead of throwing.
 */
export function parseRedisJson<T>(schema: ZodType<T>, raw: unknown, key: string): T | null {
  let value: unknown
  try {
    value = typeof raw === "string" ? JSON.parse(raw) : raw
  } catch {
    log.warn("Redis JSON parse failed", { key })
    return null
  }
  const result = schema.safeParse(value)
  if (!result.success) {
    log.warn("Redis validation failed", { key, error: result.error.message })
    return null
  }
  return result.data
}

/**
 * Fetch a Redis key and validate it against a Zod schema.
 * Returns null if the key doesn't exist or if parsing/validation fails.
 */
export async function getValidatedRedis<T>(key: string, schema: ZodType<T>): Promise<T | null> {
  const raw = await redis.get(key)
  if (raw == null) return null
  return parseRedisJson(schema, raw, key)
}

/**
 * Fetch a Redis key and validate it against a Zod schema.
 * Returns the provided default if the key doesn't exist or if parsing/validation fails.
 */
export async function getValidatedRedisOr<T>(key: string, schema: ZodType<T>, defaultValue: T): Promise<T> {
  const result = await getValidatedRedis(key, schema)
  return result ?? defaultValue
}
