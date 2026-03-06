import { fromPromise, type Result, type ResultAsync } from "neverthrow"
import { log } from "@/lib/logger.ts"
import { captureError } from "@/lib/sentry.ts"

export type AnimaErrorTag =
  | "REDIS_ERROR"
  | "DB_ERROR"
  | "LLM_ERROR"
  | "PARSE_ERROR"
  | "VALIDATION_ERROR"
  | "GUARDIAN_BLOCKED"
  | "TRUST_BLOCKED"
  | "WORKFLOW_ERROR"
  | "TELEGRAM_ERROR"
  | "VECTOR_ERROR"
  | "PERCEPTION_ERROR"
  | "EMOTION_ERROR"
  | "MEMORY_ERROR"
  | "REFLECTION_ERROR"
  | "EVOLUTION_ERROR"
  | "DREAM_ERROR"
  | "MORNING_ERROR"
  | "CONFIG_ERROR"
  | "SOMA_ERROR"
  | "COGNITION_ERROR"
  | "POLYPHONY_ERROR"
  | "ATTACHMENT_ERROR"
  | "PSYCHE_ERROR"
  | "DISSONANCE_ERROR"
  | "VULNERABILITY_ERROR"
  | "FEEL_ERROR"
  | "UNKNOWN_ERROR"

export interface AnimaError {
  tag: AnimaErrorTag
  message: string
  cause?: unknown
}

export function animaError(tag: AnimaErrorTag, message: string, cause?: unknown): AnimaError {
  return { tag, message, cause }
}

export function fromCatch(tag: AnimaErrorTag, e: unknown): AnimaError {
  if (e instanceof Error) {
    return { tag, message: e.message, cause: e }
  }
  if (
    typeof e === "object" &&
    e !== null &&
    "message" in e &&
    typeof (e as { message: unknown }).message === "string"
  ) {
    return { tag, message: (e as { message: string }).message, cause: e }
  }
  return { tag, message: String(e), cause: e }
}

/**
 * Extract a human-readable message from an unknown caught value.
 */
export function extractErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (
    typeof e === "object" &&
    e !== null &&
    "message" in e &&
    typeof (e as { message: unknown }).message === "string"
  ) {
    return (e as { message: string }).message
  }
  return String(e)
}

export type AnimaResult<T> = Result<T, AnimaError>
export type AnimaResultAsync<T> = ResultAsync<T, AnimaError>

/**
 * Wrap an async operation in a Result, catching any thrown errors.
 */
export function trySafe<T>(tag: AnimaErrorTag, operation: () => Promise<T>): AnimaResultAsync<T> {
  return fromPromise(operation(), (e) => fromCatch(tag, e))
}

/**
 * Log an AnimaError and capture it in Sentry.
 */
export function logAndCaptureError(error: AnimaError, extra?: Record<string, unknown>): void {
  log.error(`[${error.tag}] ${error.message}`, { ...extra, cause: error.cause })
  captureError(error.cause ?? error.message, { tag: error.tag, ...extra })
}
