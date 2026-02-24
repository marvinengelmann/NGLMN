import { schedules } from "@trigger.dev/sdk"
import { isDreamTime, runDreamCycle } from "@/dream/orchestrator.ts"
import { log } from "@/lib/logger.ts"
import { captureError } from "@/lib/sentry.ts"
import { TIMEZONE } from "@/lib/time.ts"
import { evolutionTask } from "./evolution.ts"

export const dreamTask = schedules.task({
  id: "dream",
  cron: {
    pattern: "0 3 * * *",
    timezone: TIMEZONE
  },
  queue: {
    concurrencyLimit: 1
  },
  run: async () => {
    if (!isDreamTime()) {
      log.info("Not dream time, skipping")
      return { action: "skipped", reason: "not dream time" }
    }

    log.info("Starting dream cycle")
    const result = await runDreamCycle()

    if (result.errors.length > 0) {
      for (const err of result.errors) {
        captureError(err, { phase: "dream_cycle" })
      }
      log.warn("Dream cycle completed with errors", { errors: result.errors })
    } else {
      log.info("Dream cycle completed successfully", {
        consolidation: result.consolidation,
        creative: result.creative,
        reflectionInsights: result.reflection?.insights.length ?? 0
      })
    }

    if (result.evolutionTriggers.length > 0) {
      log.info("Triggering evolution from dream insights", {
        count: result.evolutionTriggers.length
      })
      for (const trigger of result.evolutionTriggers) {
        await evolutionTask.trigger(trigger)
      }
    }

    return { action: "completed", result }
  }
})
