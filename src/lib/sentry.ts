import * as Sentry from "@sentry/node"
import { tasks } from "@trigger.dev/sdk"
import { env } from "@/config/env.ts"
import { log } from "@/lib/logger.ts"
import { extractErrorMessage } from "@/lib/result.ts"

/**
 * Initialize Sentry SDK and register Trigger.dev failure handler.
 */
export function setupSentry(): void {
  Sentry.init({
    dsn: env().SENTRY_DSN,
    environment: env().NODE_ENV === "production" ? "production" : "development",
    skipOpenTelemetrySetup: true,
    enableLogs: true
  })

  tasks.onFailure(({ payload, error, ctx }) => {
    Sentry.captureException(error, {
      extra: { payload },
      tags: {
        taskId: ctx.task.id,
        runId: ctx.run.id
      }
    })
  })
}

interface TickContext {
  tickId: string
  decision?: string
  tier?: string
}

let _isSendingAlert = false

function formatAlertMessage(error: unknown, context?: Record<string, unknown>): string {
  const message = extractErrorMessage(error)
  const location = context?.phase ?? context?.service ?? context?.module
  return location ? `${location}: ${message}` : message
}

/**
 * Capture an exception with optional extra context.
 * Converts non-Error values to Error objects for better stack traces.
 * Also sends a Telegram alert (fire-and-forget) unless already sending one.
 * Silently swallows any Sentry-internal failures.
 */
export function captureError(error: unknown, context?: Record<string, unknown>): void {
  try {
    const exception = error instanceof Error ? error : new Error(String(error))
    Sentry.captureException(exception, context ? { extra: context } : undefined)
  } catch {
    // Sentry must never crash the application
  }

  if (!_isSendingAlert) {
    _isSendingAlert = true
    import("@/integrations/telegram")
      .then(({ sendSystemNotification }) => sendSystemNotification(formatAlertMessage(error, context)))
      .catch((alertError) => {
        log.error("Failed to send Telegram alert", { error: extractErrorMessage(alertError) })
      })
      .finally(() => {
        _isSendingAlert = false
      })
  }
}

/**
 * Set tags and context for the current tick so all events
 * within this tick are filterable in the Sentry dashboard.
 */
export function setTickContext(context: TickContext): void {
  try {
    Sentry.setTag("tickId", context.tickId)
    if (context.decision) Sentry.setTag("decision", context.decision)
    if (context.tier) Sentry.setTag("tier", context.tier)
    Sentry.setContext("tick", { ...context })
  } catch {
    // Sentry must never crash the application
  }
}

/**
 * Store the current emotional state as a Sentry context panel
 * for richer debugging information on error events.
 */
export function setEmotionContext(emotion: Record<string, number>): void {
  try {
    Sentry.setContext("emotion", emotion)
  } catch {
    // Sentry must never crash the application
  }
}

/**
 * Add a categorized breadcrumb to the current Sentry scope.
 */
export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>,
  level?: Sentry.SeverityLevel
): void {
  try {
    Sentry.addBreadcrumb({ category, message, data, level: level ?? "info" })
  } catch {
    // Sentry must never crash the application
  }
}
