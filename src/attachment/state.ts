import { desc } from "drizzle-orm"
import { db } from "@/db/client.ts"
import { attachmentLog, relationshipPhaseLog } from "@/db/schema.ts"
import { redis } from "@/integrations/redis.ts"
import { nowISO } from "@/lib/time.ts"
import {
  AttachmentDynamics,
  type AttachmentSnapshot,
  AttachmentStyle,
  DEFAULT_ATTACHMENT,
  type RelationshipPhase
} from "./types.ts"

const KEYS = {
  CURRENT: "working:attachment:current",
  DYNAMICS: "working:attachment:dynamics",
  PHASE: "working:attachment:phase",
  PHASE_SINCE: "working:attachment:phaseSince",
  PHASE_TICK_COUNT: "working:attachment:phaseTickCount"
} as const

/**
 * Get current attachment style: Redis → DB → DEFAULT.
 */
export async function getAttachmentStyle(): Promise<AttachmentStyle> {
  const raw = await redis.get(KEYS.CURRENT)
  if (raw != null) {
    const parsed = AttachmentStyle.safeParse(typeof raw === "string" ? JSON.parse(raw) : raw)
    if (parsed.success) return parsed.data
  }

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
 * Get current attachment dynamics from Redis.
 */
export async function getAttachmentDynamics(): Promise<AttachmentDynamics | null> {
  const raw = await redis.get(KEYS.DYNAMICS)
  if (raw == null) return null
  const parsed = AttachmentDynamics.safeParse(typeof raw === "string" ? JSON.parse(raw) : raw)
  return parsed.success ? parsed.data : null
}

/**
 * Save attachment style to Redis.
 */
export async function saveAttachmentStyle(style: AttachmentStyle): Promise<void> {
  await redis.set(KEYS.CURRENT, style)
}

/**
 * Save attachment dynamics to Redis.
 */
export async function saveAttachmentDynamics(dynamics: AttachmentDynamics): Promise<void> {
  await redis.set(KEYS.DYNAMICS, dynamics)
}

/**
 * Save a full attachment snapshot to Redis and DB.
 */
export async function saveAttachmentSnapshot(snapshot: AttachmentSnapshot, trigger: string): Promise<void> {
  await Promise.all([redis.set(KEYS.CURRENT, snapshot.style), redis.set(KEYS.DYNAMICS, snapshot.dynamics)])
  await db.insert(attachmentLog).values({
    style: snapshot.style,
    dynamics: snapshot.dynamics,
    trigger
  })
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

/**
 * Get recent attachment history from DB.
 */
export async function getAttachmentHistory(limit = 10): Promise<AttachmentSnapshot[]> {
  const rows = await db.select().from(attachmentLog).orderBy(desc(attachmentLog.createdAt)).limit(limit)
  return rows
    .map((r) => {
      const style = AttachmentStyle.safeParse(r.style)
      const dynamics = AttachmentDynamics.safeParse(r.dynamics)
      if (!style.success || !dynamics.success) return null
      return { style: style.data, dynamics: dynamics.data, timestamp: r.createdAt.toISOString() }
    })
    .filter((r): r is AttachmentSnapshot => r != null)
}
