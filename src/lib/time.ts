import { TZDate } from "@date-fns/tz"
import { formatISO } from "date-fns"
import { env } from "@/config/env.ts"

export const TIMEZONE = env().OPERATOR_TIMEZONE

/**
 * Returns the current time as a TZDate in the operator's configured timezone.
 * Works seamlessly with all date-fns functions (getHours, getDay, etc.).
 */
export function nowLocal(): TZDate {
  return TZDate.tz(TIMEZONE)
}

/**
 * Returns the current time as an ISO 8601 string.
 */
export function nowISO(): string {
  return formatISO(new Date())
}

/**
 * Returns the current time as a filename/path-safe ISO string (colons and dots replaced with dashes).
 */
export function nowFilename(): string {
  return formatISO(new Date()).replace(/[:.]/g, "-")
}

/**
 * Returns a promise that resolves after the specified number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
