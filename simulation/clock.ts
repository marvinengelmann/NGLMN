import { TZDate } from "@date-fns/tz"
import { addMinutes, formatISO } from "date-fns"

const DEFAULT_TIMEZONE = "Europe/Berlin"

export interface SimulationClock {
  readonly current: Date
  now(): Date
  nowISO(): string
  nowLocal(): TZDate
  advance(minutes: number): void
  elapsedMinutesSince(timestamp: string | null): number
  readonly totalElapsedMinutes: number
}

export function createClock(startTime: Date, timezone = DEFAULT_TIMEZONE): SimulationClock {
  let current = new Date(startTime.getTime())
  const origin = new Date(startTime.getTime())

  return {
    get current() {
      return new Date(current.getTime())
    },

    now() {
      return new Date(current.getTime())
    },

    nowISO() {
      return formatISO(current)
    },

    nowLocal() {
      return new TZDate(current, timezone)
    },

    advance(minutes: number) {
      current = addMinutes(current, minutes)
    },

    elapsedMinutesSince(timestamp: string | null): number {
      if (!timestamp) return 1
      return Math.max(1, (current.getTime() - new Date(timestamp).getTime()) / 60000)
    },

    get totalElapsedMinutes() {
      return (current.getTime() - origin.getTime()) / 60000
    }
  }
}
