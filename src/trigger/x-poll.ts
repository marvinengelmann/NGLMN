import { schedules } from "@trigger.dev/sdk"
import { hasXConfig } from "@/config/env.ts"
import { pollNewMentions } from "@/integrations/x.ts"
import { log } from "@/lib/logger.ts"

/**
 * Polls X for new mentions every 5 minutes.
 * Triggers the X handler if new mentions are found.
 */
export const xPollTask = schedules.task({
  id: "x-poll",
  cron: "*/5 * * * *",
  queue: {
    concurrencyLimit: 1
  },
  run: async () => {
    if (!hasXConfig()) {
      log.debug("X poll skipped — not configured")
      return { newMentions: 0, reason: "not_configured" }
    }

    const count = await pollNewMentions()
    log.info("Polled X mentions", { newMentions: count })

    if (count > 0) {
      /** @see Trigger.dev requires dynamic imports to prevent circular task registration */
      const { xHandlerTask } = await import("@/trigger/x-handler.ts")
      await xHandlerTask.trigger()
      log.info("Triggered X handler")
    }

    return { newMentions: count }
  }
})
