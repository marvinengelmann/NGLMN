import { desc } from "drizzle-orm"
import { db } from "@/db/client.ts"
import { psycheSnapshots } from "@/db/schema.ts"
import { redis } from "@/integrations/redis.ts"
import { DEFAULT_SELF_CONCEPT, type PsycheSnapshot, SelfConcept } from "./types.ts"

const KEYS = {
  CURRENT: "working:psyche:current",
  ASPIRATIONS: "working:psyche:aspirations",
  FEARS: "working:psyche:fears",
  NARRATIVE_SUMMARY: "working:psyche:narrativeSummary"
} as const

/**
 * Get current self concept: Redis → DB → DEFAULT.
 */
export async function getSelfConcept(): Promise<SelfConcept> {
  const raw = await redis.get(KEYS.CURRENT)
  if (raw != null) {
    try {
      const parsed = SelfConcept.safeParse(typeof raw === "string" ? JSON.parse(raw) : raw)
      if (parsed.success) return parsed.data
    } catch {}
  }

  const rows = await db.select().from(psycheSnapshots).orderBy(desc(psycheSnapshots.createdAt)).limit(1)
  if (rows[0]) {
    const parsed = SelfConcept.safeParse(rows[0].selfConcept)
    if (parsed.success) {
      await redis.set(KEYS.CURRENT, parsed.data)
      return parsed.data
    }
  }

  return DEFAULT_SELF_CONCEPT
}

/**
 * Save a full psyche snapshot to Redis and DB.
 */
export async function savePsycheSnapshot(snapshot: PsycheSnapshot): Promise<void> {
  await db.insert(psycheSnapshots).values({
    selfConcept: snapshot.selfConcept,
    aspirations: snapshot.aspirations,
    fears: snapshot.fears,
    narrativeSummary: snapshot.narrativeSummary
  })
  await Promise.all([
    redis.set(KEYS.CURRENT, snapshot.selfConcept),
    redis.set(KEYS.ASPIRATIONS, snapshot.aspirations),
    redis.set(KEYS.FEARS, snapshot.fears),
    redis.set(KEYS.NARRATIVE_SUMMARY, snapshot.narrativeSummary)
  ])
}

/**
 * Save just the self concept to Redis (for incremental updates).
 */
export async function saveSelfConcept(concept: SelfConcept): Promise<void> {
  await redis.set(KEYS.CURRENT, concept)
}

/**
 * Get recent psyche snapshots from DB.
 */
export async function getRecentSnapshots(limit = 5): Promise<PsycheSnapshot[]> {
  const rows = await db.select().from(psycheSnapshots).orderBy(desc(psycheSnapshots.createdAt)).limit(limit)
  return rows
    .map((r) => {
      const parsed = SelfConcept.safeParse(r.selfConcept)
      if (!parsed.success) return null
      return {
        selfConcept: parsed.data,
        aspirations: (r.aspirations as string[]) ?? [],
        fears: (r.fears as string[]) ?? [],
        narrativeSummary: r.narrativeSummary ?? "",
        timestamp: r.createdAt.toISOString()
      }
    })
    .filter((r): r is PsycheSnapshot => r != null)
}
