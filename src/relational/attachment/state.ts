import { desc } from "drizzle-orm"
import { db } from "@/infra/db/client.ts"
import { attachmentLog, relationshipPhaseLog } from "@/infra/db/schema.ts"
import { getValidatedRedis, redis } from "@/infra/integrations/redis.ts"
import { nowISO } from "@/infra/lib/time.ts"
import {
  AttachmentStyle,
  DEFAULT_ATTACHMENT,
  DEFAULT_ISOLATION_STRESS,
  type IsolationStress,
  IsolationStress as IsolationStressSchema,
  type RelationshipPhase
} from "./types.ts"

const KEYS = {
  CURRENT: "working:attachment:current",
  PHASE: "working:attachment:phase",
  PHASE_SINCE: "working:attachment:phaseSince",
  PHASE_TICK_COUNT: "working:attachment:phaseTickCount",
  ISOLATION_STRESS: "working:attachment:isolation"
} as const

/**
 * Get current attachment style: Redis → DB → DEFAULT.
 */
export async function getAttachmentStyle(): Promise<AttachmentStyle> {
  const fromRedis = await getValidatedRedis(KEYS.CURRENT, AttachmentStyle)
  if (fromRedis) return fromRedis

  const rows = await db.select().from(attachmentLog).orderBy(desc(attachmentLog.createdAt)).limit(1)
  if (rows[0]) {
    const parsed = AttachmentStyle.safeParse(rows[0].style)
    if (parsed.success) {
      await redis.set(KEYS.CURRENT, parsed.data)
      return parsed.data
    }
  }

  return DEFAULT_ATTACHMENT
}

/**
 * Get current relationship phase from Redis.
 */
export async function getRelationshipPhase(): Promise<RelationshipPhase> {
  const raw = await redis.get<string>(KEYS.PHASE)
  return (raw as RelationshipPhase) ?? "discovering"
}

/**
 * Get the tick count for the current phase.
 */
export async function getPhaseTickCount(): Promise<number> {
  const raw = await redis.get<number>(KEYS.PHASE_TICK_COUNT)
  return raw ?? 0
}

/**
 * Increment the phase tick counter.
 */
export async function incrementPhaseTickCount(): Promise<void> {
  await redis.incr(KEYS.PHASE_TICK_COUNT)
}

/**
 * Save a new relationship phase, log the transition to DB, and reset tick counter.
 */
export async function saveRelationshipPhase(
  phase: RelationshipPhase,
  previousPhase: RelationshipPhase,
  trigger: string
): Promise<void> {
  await Promise.all([
    redis.set(KEYS.PHASE, phase),
    redis.set(KEYS.PHASE_SINCE, nowISO()),
    redis.set(KEYS.PHASE_TICK_COUNT, 0)
  ])
  await db.insert(relationshipPhaseLog).values({
    phase,
    previousPhase,
    trigger
  })
}

const REL_KEYS = {
  RELATIONSHIP_CONFLICT_COUNT: "working:relationship:conflictCount",
  RELATIONSHIP_FIRST_INTERACTION_AT: "working:relationship:firstInteractionAt",
  RELATIONSHIP_TOTAL_INTERACTIONS: "working:relationship:totalInteractions"
} as const

export async function getConflictCount(): Promise<number> {
  const raw = await redis.get<number>(REL_KEYS.RELATIONSHIP_CONFLICT_COUNT)
  return raw ?? 0
}

export async function incrementConflictCount(): Promise<void> {
  await redis.incr(REL_KEYS.RELATIONSHIP_CONFLICT_COUNT)
}

export async function getFirstInteractionAt(): Promise<string | null> {
  return redis.get<string>(REL_KEYS.RELATIONSHIP_FIRST_INTERACTION_AT)
}

export async function setFirstInteractionAt(isoTimestamp: string): Promise<void> {
  await redis.set(REL_KEYS.RELATIONSHIP_FIRST_INTERACTION_AT, isoTimestamp)
}

export async function getTotalInteractions(): Promise<number> {
  const raw = await redis.get<number>(REL_KEYS.RELATIONSHIP_TOTAL_INTERACTIONS)
  return raw ?? 0
}

export async function incrementTotalInteractions(): Promise<void> {
  await redis.incr(REL_KEYS.RELATIONSHIP_TOTAL_INTERACTIONS)
}

/**
 * Get current isolation stress state from Redis.
 */
export async function getIsolationStress(): Promise<IsolationStress> {
  const fromRedis = await getValidatedRedis(KEYS.ISOLATION_STRESS, IsolationStressSchema)
  return fromRedis ?? DEFAULT_ISOLATION_STRESS
}
