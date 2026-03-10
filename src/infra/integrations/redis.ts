import { Redis } from "@upstash/redis"
import type { ZodType } from "zod"
import { log } from "@/infra/lib/logger.ts"

export const redis = Redis.fromEnv()

/**
 * Parse a raw Redis value against a Zod schema with JSON deserialization.
 * Returns null (with a warning log) on parse or validation failure instead of throwing.
 */
export function parseRedisJson<T>(schema: ZodType<T>, raw: unknown, key: string): T | null {
  let value: unknown
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw)
    } catch {
      value = raw
    }
  } else {
    value = raw
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

/**
 * Fetch multiple Redis keys in a single roundtrip and validate each against its schema.
 * Returns an array of validated values, using the default when a key is missing or invalid.
 */
export async function mgetValidatedRedis<T>(
  entries: Array<{ key: string; schema: ZodType<T>; defaultValue: T }>
): Promise<T[]> {
  if (entries.length === 0) return []
  const keys = entries.map((e) => e.key)
  const rawValues = await redis.mget<(string | null)[]>(...keys)
  return entries.map((entry, i) => {
    const raw = rawValues[i]
    if (raw == null) return entry.defaultValue
    return parseRedisJson(entry.schema, raw, entry.key) ?? entry.defaultValue
  })
}
