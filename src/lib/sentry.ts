import * as Sentry from "@sentry/node"
import { tasks } from "@trigger.dev/sdk"
import { env } from "@/config/env.ts"

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
  const message = error instanceof Error ? error.message : String(error)
  const errorType = error instanceof Error ? error.constructor.name : "Error"
  const location = context?.phase ?? context?.service ?? context?.module
  const lines = [`🚨 *[CRITICAL]* Sentry Error`]
  if (location) lines.push(`📍 Phase: ${location}`)
  lines.push(`💬 ${errorType}: ${message}`)
  return lines.join("\n")
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
      .then(({ sendAlert }) => sendAlert("critical", formatAlertMessage(error, context)))
      .catch((alertError) => {
        console.error(
          "Failed to send Telegram alert",
          alertError instanceof Error ? alertError.message : String(alertError)
        )
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
export function setTickContext(ctx: TickContext): void {
  try {
    Sentry.setTag("tickId", ctx.tickId)
    if (ctx.decision) Sentry.setTag("decision", ctx.decision)
    if (ctx.tier) Sentry.setTag("tier", ctx.tier)
    Sentry.setContext("tick", { ...ctx })
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
