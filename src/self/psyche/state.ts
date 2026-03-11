import { desc } from "drizzle-orm"
import * as z from "zod"
import { db } from "@/infra/db/client.ts"
import { psycheSnapshots } from "@/infra/db/schema.ts"
import { getValidatedRedis, getValidatedRedisOr, redis } from "@/infra/integrations/redis.ts"
import { getGenesisDNA } from "@/self/genesis/state.ts"
import { DEFAULT_SELF_CONCEPT, GrowthArc, NarrativeEntry, type PsycheSnapshot, SelfConcept } from "./types.ts"

const KEYS = {
  CURRENT: "working:psyche:current",
  ASPIRATIONS: "working:psyche:aspirations",
  FEARS: "working:psyche:fears",
  NARRATIVE_SUMMARY: "working:psyche:narrativeSummary",
  IDENTITY_STATEMENTS: "working:psyche:identityStatements",
  GROWTH_ARCS: "working:psyche:growthArcs",
  RECENT_NARRATIVES: "working:psyche:recentNarratives"
} as const

const MAX_IDENTITY_STATEMENTS = 5
const MAX_GROWTH_ARCS = 10
const MAX_RECENT_NARRATIVES = 5

/**
 * Get current self concept: Redis → DB → DEFAULT.
 */
export async function getSelfConcept(): Promise<SelfConcept> {
  const fromRedis = await getValidatedRedis(KEYS.CURRENT, SelfConcept)
  if (fromRedis) return fromRedis

  const rows = await db.select().from(psycheSnapshots).orderBy(desc(psycheSnapshots.createdAt)).limit(1)
  if (rows[0]) {
    const parsed = SelfConcept.safeParse(rows[0].selfConcept)
    if (parsed.success) {
      await redis.set(KEYS.CURRENT, parsed.data)
      return parsed.data
    }
  }

  const dna = await getGenesisDNA()
  if (dna) return dna.initialSelfConcept

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

export async function getIdentityStatements(): Promise<string[]> {
  return getValidatedRedisOr(KEYS.IDENTITY_STATEMENTS, z.array(z.string()), [])
}

export async function saveIdentityStatements(statements: string[]): Promise<void> {
  await redis.set(KEYS.IDENTITY_STATEMENTS, statements.slice(0, MAX_IDENTITY_STATEMENTS))
}

export async function getGrowthArcs(): Promise<GrowthArc[]> {
  return getValidatedRedisOr(KEYS.GROWTH_ARCS, z.array(GrowthArc), [])
}

export async function addGrowthArc(arc: GrowthArc): Promise<void> {
  const existing = await getGrowthArcs()
  const updated = [...existing, arc].slice(-MAX_GROWTH_ARCS)
  await redis.set(KEYS.GROWTH_ARCS, updated)
}

export async function getRecentNarratives(): Promise<NarrativeEntry[]> {
  return getValidatedRedisOr(KEYS.RECENT_NARRATIVES, z.array(NarrativeEntry), [])
}

export async function addNarrativeEntry(entry: NarrativeEntry): Promise<void> {
  const existing = await getRecentNarratives()
  const updated = [...existing, entry].slice(-MAX_RECENT_NARRATIVES)
  await redis.set(KEYS.RECENT_NARRATIVES, updated)
}
