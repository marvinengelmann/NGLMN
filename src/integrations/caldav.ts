import { addHours } from "date-fns"
import { DAVClient } from "tsdav"
import { CALENDAR } from "@/config/constants.ts"
import { env } from "@/config/env.ts"
import { log } from "@/lib/logger.ts"
import type { CalendarEvent } from "./types.ts"

export function isCaldavEnabled(): boolean {
  return !!(process.env.CALDAV_SERVER_URL && process.env.CALDAV_USER && process.env.CALDAV_PASS)
}

function parseICalValue(data: string, key: string): string | undefined {
  const regex = new RegExp(`^${key}[^:]*:(.+)$`, "m")
  const match = data.match(regex)
  return match?.[1]?.trim()
}

function parseICalDate(value: string): { date: Date; allDay: boolean } {
  if (value.length === 8) {
    const year = Number.parseInt(value.slice(0, 4))
    const month = Number.parseInt(value.slice(4, 6)) - 1
    const day = Number.parseInt(value.slice(6, 8))
    return { date: new Date(year, month, day), allDay: true }
  }

  const cleaned = value.replace(/Z$/, "")
  const year = Number.parseInt(cleaned.slice(0, 4))
  const month = Number.parseInt(cleaned.slice(4, 6)) - 1
  const day = Number.parseInt(cleaned.slice(6, 8))
  const hour = Number.parseInt(cleaned.slice(9, 11))
  const minute = Number.parseInt(cleaned.slice(11, 13))
  const second = Number.parseInt(cleaned.slice(13, 15))

  const date = value.endsWith("Z")
    ? new Date(Date.UTC(year, month, day, hour, minute, second))
    : new Date(year, month, day, hour, minute, second)

  return { date, allDay: false }
}

function parseVEvents(icalData: string): CalendarEvent[] {
  const events: CalendarEvent[] = []
  const vevents = icalData.split("BEGIN:VEVENT")

  for (let i = 1; i < vevents.length; i++) {
    const block = vevents[i]!.split("END:VEVENT")[0] ?? ""

    const uid = parseICalValue(block, "UID")
    const summary = parseICalValue(block, "SUMMARY")
    const location = parseICalValue(block, "LOCATION")
    const dtstart = parseICalValue(block, "DTSTART")
    const dtend = parseICalValue(block, "DTEND")

    if (!uid || !summary || !dtstart) continue

    const start = parseICalDate(dtstart)
    const end = dtend ? parseICalDate(dtend) : { date: addHours(start.date, 1), allDay: start.allDay }

    events.push({
      uid,
      summary,
      location: location || undefined,
      start: start.date.toISOString(),
      end: end.date.toISOString(),
      allDay: start.allDay
    })
  }

  return events
}

/**
 * Fetch upcoming calendar events from CalDAV server.
 */
export async function fetchUpcomingEvents(windowHours: number): Promise<CalendarEvent[]> {
  const client = new DAVClient({
    serverUrl: env().CALDAV_SERVER_URL!,
    credentials: { username: env().CALDAV_USER!, password: env().CALDAV_PASS! },
    authMethod: "Basic",
    defaultAccountType: "caldav"
  })

  await client.login()
  const calendars = await client.fetchCalendars()

  const now = new Date()
  const end = addHours(now, windowHours)
  const allEvents: CalendarEvent[] = []

  for (const calendar of calendars) {
    try {
      const objects = await client.fetchCalendarObjects({
        calendar,
        timeRange: {
          start: now.toISOString(),
          end: end.toISOString()
        },
        expand: true
      })

      for (const obj of objects) {
        if (obj.data) {
          const parsed = parseVEvents(obj.data)
          allEvents.push(...parsed)
        }
      }
    } catch (e) {
      log.warn("Failed to fetch from calendar", {
        calendar: calendar.displayName,
        error: e instanceof Error ? e.message : String(e)
      })
    }
  }

  return allEvents
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, CALENDAR.MAX_UPCOMING_EVENTS)
}
