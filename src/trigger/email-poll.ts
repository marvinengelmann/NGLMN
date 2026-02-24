import { schedules } from "@trigger.dev/sdk"
import { pollNewEmails } from "@/integrations/resend.ts"
import { log } from "@/lib/logger.ts"

/**
 * Polls Resend for new received emails every 5 minutes.
 * Triggers the email handler if new emails are found.
 */
export const emailPollTask = schedules.task({
  id: "email-poll",
  cron: "*/5 * * * *",
  queue: {
    concurrencyLimit: 1
  },
  run: async () => {
    const count = await pollNewEmails()
    log.info("Polled Resend", { newEmails: count })

    if (count > 0) {
      /** @see Trigger.dev requires dynamic imports to prevent circular task registration */
      const { emailHandlerTask } = await import("@/trigger/email-handler.ts")
      await emailHandlerTask.trigger()
      log.info("Triggered email handler")
    }

    return { newEmails: count }
  }
})
