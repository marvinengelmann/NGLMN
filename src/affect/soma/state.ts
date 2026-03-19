import { and, desc, gte, lte } from "drizzle-orm"
import { db } from "@/infra/db/client.ts"
import { somaticHistory } from "@/infra/db/schema.ts"
import { getValidatedRedis, redis } from "@/infra/integrations/redis.ts"
import { queryRelated } from "@/memory/episodic.ts"
import { INTEROCEPTION, SOMA } from "./constants.ts"
import { AutonomicState, DEFAULT_AUTONOMIC_STATE, DEFAULT_SOMATIC_STATE, SomaticState } from "./types.ts"

const KEYS = {
  CURRENT: "working:soma:current",
  LAST_TIMESTAMP: "working:soma:lastTimestamp",
  AUTONOMIC: "working:soma:autonomic",
  INTEROCEPTIVE_ACCURACY: "working:soma:interoceptiveAccuracy"
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
      await redis.set(KEYS.CURRENT, parsed.data, { ex: 3600 })
      return parsed.data
    }
  }

  return DEFAULT_SOMATIC_STATE
}

/**
 * Save somatic state to Redis and DB history.
 */
export async function saveSomaticState(state: SomaticState, trigger: string, tickId?: string): Promise<void> {
  await redis.set(KEYS.CURRENT, state, { ex: 3600 })
  await redis.set(KEYS.LAST_TIMESTAMP, new Date().toISOString(), { ex: 3600 })
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
 * Get somatic states recorded near the given timestamps (±5 min window).
 * Used to retrieve body states from episodically similar past situations.
 */
async function getSomaticStatesNear(timestamps: string[], limit: number): Promise<SomaticState[]> {
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

/**
 * Get the most recent somatic states from DB history for trajectory computation.
 */
export async function getRecentSomaHistory(
  limit: number = INTEROCEPTION.TRAJECTORY_HISTORY_SIZE
): Promise<SomaticState[]> {
  const rows = await db.select().from(somaticHistory).orderBy(desc(somaticHistory.createdAt)).limit(limit)

  return rows
    .map((r) => SomaticState.safeParse(r.state))
    .filter((r) => r.success)
    .map((r) => r.data)
    .reverse()
}

/**
 * Get current autonomic state from Redis, falling back to default.
 */
export async function getAutonomicState(): Promise<AutonomicState> {
  const fromRedis = await getValidatedRedis(KEYS.AUTONOMIC, AutonomicState)
  return fromRedis ?? DEFAULT_AUTONOMIC_STATE
}

/**
 * Get current interoceptive accuracy from Redis, falling back to initial value.
 */
export async function getInteroceptiveAccuracy(): Promise<number> {
  const raw = await redis.get<number>(KEYS.INTEROCEPTIVE_ACCURACY)
  return raw ?? INTEROCEPTION.ACCURACY_INITIAL
}
