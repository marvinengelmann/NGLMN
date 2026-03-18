import { differenceInDays, parseISO } from "date-fns"
import { db } from "@/infra/db/client.ts"
import type { EntitySelect } from "@/infra/db/schema.ts"
import { entities } from "@/infra/db/schema.ts"
import { log } from "@/infra/lib/logger.ts"
import type { AnimaResultAsync } from "@/infra/lib/result.ts"
import { trySafe } from "@/infra/lib/result.ts"
import { GRAPH_CONSTANTS } from "./types.ts"

export interface UpcomingEvent {
  entity: EntitySelect
  eventType: string
  eventDate: string
  daysUntil: number
}

const DATE_ATTRIBUTE_KEYS = ["birthday", "anniversary", "deadline", "appointment", "event_date"]

/**
 * Scan entities for upcoming date-based events (birthdays, deadlines, appointments).
 */
export function getUpcomingEvents(
  daysAhead: number = GRAPH_CONSTANTS.ANTICIPATION_DAYS_AHEAD
): AnimaResultAsync<UpcomingEvent[]> {
  return trySafe("GRAPH_ERROR", async () => {
    const allEntities = await db.select().from(entities)
    const now = new Date()
    const upcoming: UpcomingEvent[] = []

    for (const entity of allEntities) {
      const attrs = entity.attributes as Record<string, unknown>

      for (const key of DATE_ATTRIBUTE_KEYS) {
        const dateStr = attrs[key]
        if (typeof dateStr !== "string") continue

        try {
          const eventDate = parseISO(dateStr)
          const adjustedEvent = adjustForAnnualRecurrence(eventDate, now, key)
          const daysUntil = differenceInDays(adjustedEvent, now)

          if (daysUntil >= 0 && daysUntil <= daysAhead) {
            upcoming.push({ entity, eventType: key, eventDate: dateStr, daysUntil })
          }
        } catch {
          log.debug("Failed to parse date attribute", { entityName: entity.name, key, value: dateStr })
        }
      }
    }

    upcoming.sort((a, b) => a.daysUntil - b.daysUntil)
    return upcoming
  })
}

function adjustForAnnualRecurrence(eventDate: Date, now: Date, eventType: string): Date {
  const annualTypes = ["birthday", "anniversary"]
  if (!annualTypes.includes(eventType)) return eventDate

  const thisYear = new Date(now.getFullYear(), eventDate.getMonth(), eventDate.getDate())
  if (thisYear < now) {
    return new Date(now.getFullYear() + 1, eventDate.getMonth(), eventDate.getDate())
  }
  return thisYear
}
