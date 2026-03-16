import { desc } from "drizzle-orm"
import { db } from "@/infra/db/client.ts"
import { events } from "@/infra/db/schema.ts"
import { log } from "@/infra/lib/logger.ts"

export type EventType =
  | "lifecycle_started"
  | "lifecycle_ended"
  | "sleep_started"
  | "woke_up"
  | "dream_started"
  | "dream_ended"
  | "conversation_started"
  | "conversation_ended"
  | "goal_created"
  | "goal_completed"
  | "goal_failed"
  | "creative_output"
  | "evolution_applied"
  | "posted_to_x"
  | "reflection_completed"
  | "guardian_blocked"
  | "guardian_warned"
  | "altered_state_started"

interface RecordEventOptions {
  type: EventType
  detail?: string
  metadata?: Record<string, unknown>
  tickId?: string
}

export async function recordEvent({ type, detail, metadata, tickId }: RecordEventOptions): Promise<void> {
  await db.insert(events).values({
    type,
    detail: detail ?? null,
    metadata: metadata ?? null,
    tickId: tickId ?? null
  })
  log.info("Event recorded", { type, detail })
}

export async function getRecentEvents(limit: number = 50) {
  return db.select().from(events).orderBy(desc(events.createdAt)).limit(limit)
}
