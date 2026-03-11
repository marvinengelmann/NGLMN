import { db } from "@/infra/db/client.ts"
import { dissonanceLog } from "@/infra/db/schema.ts"
import type { DissonanceEvent } from "./types.ts"

/**
 * Log a dissonance event to DB.
 */
export async function logDissonanceEvent(event: DissonanceEvent): Promise<void> {
  await db.insert(dissonanceLog).values({
    declaredValue: event.declaredValue,
    actualAction: event.actualAction,
    dissonanceScore: event.dissonanceScore,
    resolution: event.resolution ?? null
  })
}
