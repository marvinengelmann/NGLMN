import * as Sentry from "@sentry/node"
import { logger as triggerLogger } from "@trigger.dev/sdk"

type Primitive = string | number | boolean

const TRIGGER_LEVEL_MAP = {
  trace: "debug",
  debug: "debug",
  info: "info",
  warn: "warn",
  error: "error",
  fatal: "error"
} as const

/**
 * Flatten an attributes object so all values are primitives.
 * Sentry structured logs only accept string/number/boolean — complex objects are JSON-stringified.
 */
export function flattenAttributes(attrs?: Record<string, unknown>): Record<string, Primitive> | undefined {
  if (!attrs) return undefined
  const result: Record<string, Primitive> = {}
  for (const [key, value] of Object.entries(attrs)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      result[key] = value
    } else {
      result[key] = JSON.stringify(value)
    }
  }
  return result
}

function logAtLevel(
  level: "trace" | "debug" | "info" | "warn" | "error" | "fatal",
  message: string,
  attributes?: Record<string, unknown>
): void {
  try {
    Sentry.logger[level](message, flattenAttributes(attributes))
  } catch {
    // Sentry must never crash the application
  }
  try {
    const triggerLevel = TRIGGER_LEVEL_MAP[level]
    triggerLogger[triggerLevel](message, attributes)
  } catch {
    // Trigger.dev logger must never crash the application
  }
}

export const log = {
  trace: (message: string, attributes?: Record<string, unknown>) => logAtLevel("trace", message, attributes),
  debug: (message: string, attributes?: Record<string, unknown>) => logAtLevel("debug", message, attributes),
  info: (message: string, attributes?: Record<string, unknown>) => logAtLevel("info", message, attributes),
  warn: (message: string, attributes?: Record<string, unknown>) => logAtLevel("warn", message, attributes),
  error: (message: string, attributes?: Record<string, unknown>) => logAtLevel("error", message, attributes),
  fatal: (message: string, attributes?: Record<string, unknown>) => logAtLevel("fatal", message, attributes)
}
