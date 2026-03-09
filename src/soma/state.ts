import { and, desc, gte, lte } from "drizzle-orm"
import { SOMA } from "@/config/constants.ts"
import { db } from "@/db/client.ts"
import { somaticHistory } from "@/db/schema.ts"
import { getValidatedRedis, redis } from "@/integrations/redis.ts"
import { queryRelated } from "@/memory/episodic.ts"
import { DEFAULT_SOMATIC_STATE, SomaticState } from "./types.ts"

const KEYS = {
  CURRENT: "working:soma:current",
  LAST_TIMESTAMP: "working:soma:lastTimestamp"
} as const

/**
 * Get current somatic state: Redis → DB → DEFAULT.
 */
export async function getSomaticState(): Promise<SomaticState> {
  const fromRedis = await getValidatedRedis(KEYS.CURRENT, SomaticState)
  if (fromRedis) return fromRedis

  const rows = await db.select().from(somaticHistory).orderBy(desc(somaticHistory.createdAt)).limit(1)
  if (rows[0]) {
    const parsed = SomaticState.safeParse(rows[0].state)
    if (parsed.success) {
      await redis.set(KEYS.CURRENT, parsed.data)
      return parsed.data
    }
  }

  return DEFAULT_SOMATIC_STATE
}

/**
 * Save somatic state to Redis and DB history.
 */
export async function saveSomaticState(state: SomaticState, trigger: string, tickId?: string): Promise<void> {
  await redis.set(KEYS.CURRENT, state)
  await redis.set(KEYS.LAST_TIMESTAMP, new Date().toISOString())
  await db.insert(somaticHistory).values({
    state,
    trigger,
    tickId: tickId ?? null
  })
}

/**
 * Get timestamp of last somatic update.
 */
export async function getSomaticLastTimestamp(): Promise<string | null> {
  return redis.get<string>(KEYS.LAST_TIMESTAMP)
}

/**
 * Get recent somatic history from DB.
 */
export async function getSomaticHistory(limit = 10): Promise<SomaticState[]> {
  const rows = await db.select().from(somaticHistory).orderBy(desc(somaticHistory.createdAt)).limit(limit)
  return rows
    .map((r) => SomaticState.safeParse(r.state))
    .filter((r) => r.success)
    .map((r) => r.data)
}

/**
 * Get somatic states recorded near the given timestamps (±5 min window).
 * Used to retrieve body states from episodically similar past situations.
 */
export async function getSomaticStatesNear(timestamps: string[], limit: number): Promise<SomaticState[]> {
  if (timestamps.length === 0) return []

  const WINDOW_MS = 5 * 60 * 1000
  const dates = timestamps.map((t) => new Date(t).getTime())
  const earliest = new Date(Math.min(...dates) - WINDOW_MS)
  const latest = new Date(Math.max(...dates) + WINDOW_MS)

  const rows = await db
    .select()
    .from(somaticHistory)
    .where(and(gte(somaticHistory.createdAt, earliest), lte(somaticHistory.createdAt, latest)))
    .orderBy(desc(somaticHistory.createdAt))
    .limit(limit)

  return rows
    .map((r) => SomaticState.safeParse(r.state))
    .filter((r) => r.success)
    .map((r) => r.data)
}

/**
 * Query somatic memories from similar past situations.
 * Finds episodic matches, then retrieves somatic states recorded near those episodes.
 */
export async function querySomaticMemories(
  contextText: string,
  topK: number = SOMA.MEMORY_QUERY_TOP_K
): Promise<SomaticState[]> {
  const episodes = await queryRelated(contextText, topK)
  if (episodes.length === 0) return []

  const episodeTimestamps = episodes.map((e) => e.metadata?.timestamp).filter((t): t is string => t != null)

  if (episodeTimestamps.length === 0) return []

  return getSomaticStatesNear(episodeTimestamps, topK)
}
