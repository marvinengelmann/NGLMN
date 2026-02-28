import * as Sentry from "@sentry/node"
import { tasks } from "@trigger.dev/sdk"
import { env } from "@/config/env.ts"

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
