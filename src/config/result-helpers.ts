import { fromPromise, type Result, type ResultAsync } from "neverthrow"
import { log } from "@/lib/logger.ts"
import { captureError } from "@/lib/sentry.ts"
import type { AnimaError, AnimaErrorTag } from "./errors.ts"
import { fromCatch } from "./errors.ts"

export type AnimaResult<T> = Result<T, AnimaError>
export type AnimaResultAsync<T> = ResultAsync<T, AnimaError>

/**
 * Wrap an async operation in a Result, catching any thrown errors.
 */
export function trySafe<T>(tag: AnimaErrorTag, fn: () => Promise<T>): AnimaResultAsync<T> {
  return fromPromise(fn(), (e) => fromCatch(tag, e))
}

/**
 * Log an AnimaError and capture it in Sentry.
 */
export function logAndCaptureError(error: AnimaError, extra?: Record<string, unknown>): void {
  log.error(`[${error.tag}] ${error.message}`, { ...extra, cause: error.cause })
  if (error.cause instanceof Error) {
    captureError(error.cause, { tag: error.tag, ...extra })
  }
}
