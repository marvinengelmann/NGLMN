import { differenceInDays } from "date-fns"
import { log } from "@/infra/lib/logger.ts"
import type { AnimaResultAsync } from "@/infra/lib/result.ts"
import { trySafe } from "@/infra/lib/result.ts"
import { bulkUpdateSalience, getAllActiveEntities } from "./store.ts"
import { GRAPH_CONSTANTS } from "./types.ts"

/**
 * Decay salience for all active entities based on time since last mention.
 * Entities that haven't been mentioned recently gradually fade from memory.
 */
export function decaySalience(): AnimaResultAsync<number> {
  return trySafe("GRAPH_ERROR", async () => {
    const entitiesResult = await getAllActiveEntities()
    if (entitiesResult.isErr()) return 0

    const activeEntities = entitiesResult.value
    if (activeEntities.length === 0) return 0

    const now = new Date()
    const updates: Array<{ id: string; salience: number }> = []

    for (const entity of activeEntities) {
      const daysSince = differenceInDays(now, entity.lastMentionedAt)
      if (daysSince <= 0) continue

      const decayed = entity.salience * GRAPH_CONSTANTS.SALIENCE_DECAY_RATE ** daysSince
      const clamped = Math.max(0, Math.round(decayed * 1000) / 1000)

      if (Math.abs(clamped - entity.salience) > 0.001) {
        updates.push({ id: entity.id, salience: clamped })
      }
    }

    if (updates.length > 0) {
      const updateResult = await bulkUpdateSalience(updates)
      if (updateResult.isErr()) {
        log.debug("Salience bulk update failed", { error: updateResult.error.message })
        return 0
      }
      log.debug("Salience decay applied", { entitiesUpdated: updates.length })
    }

    return updates.length
  })
}
