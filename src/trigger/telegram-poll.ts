import { schedules } from "@trigger.dev/sdk"
import { formatISO } from "date-fns"
import { pollNewMessages } from "@/integrations/telegram.ts"
import { log } from "@/lib/logger.ts"
import { getConversationWaitToken, setOperatorLastActivity } from "@/memory/working.ts"

/**
 * Polls Telegram for new messages every minute and queues them for processing.
 * If a conversation handler is waiting, completes its wait token.
 * Otherwise triggers a new conversation handler.
 */
export const telegramPollTask = schedules.task({
  id: "telegram-poll",
  cron: "*/1 * * * *",
  queue: {
    concurrencyLimit: 1
  },
  run: async () => {
    const count = await pollNewMessages()
    log.info("Polled Telegram", { newMessages: count })

    if (count > 0) {
      await setOperatorLastActivity(formatISO(new Date()))

      const waitToken = await getConversationWaitToken()
      if (waitToken) {
        /** @see Trigger.dev requires dynamic imports to prevent circular task registration */
        const { wait } = await import("@trigger.dev/sdk")
        await wait.completeToken(waitToken, { resumed: true })
        log.info("Completed conversation wait token", { token: waitToken })
      } else {
        /** @see Trigger.dev requires dynamic imports to prevent circular task registration */
        const { conversationHandlerTask } = await import("@/trigger/conversation-handler.ts")
        await conversationHandlerTask.trigger({ triggerReason: "new_messages" })
        log.info("Triggered conversation handler")
      }
    }

    return { newMessages: count }
  }
})
