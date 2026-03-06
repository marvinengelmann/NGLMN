import { runs, schedules } from "@trigger.dev/sdk"
import { HEARTBEAT } from "@/config/constants.ts"
import { computeSkipProbability } from "@/consciousness/gating.ts"
import { runHeartbeat } from "@/consciousness/heartbeat.ts"
import { isLifeEventActive, maybeStartLifeEvent } from "@/consciousness/lifecycle.ts"
import { fetchNewMessages } from "@/integrations/telegram.ts"
import { log } from "@/lib/logger.ts"
import { getConversationWaitingSince, getCurrentEmotion, isBusy } from "@/memory/working.ts"

export const heartbeatTask = schedules.task({
  id: "heartbeat",
  cron: HEARTBEAT.CRON,
  queue: {
    concurrencyLimit: HEARTBEAT.CONCURRENCY
  },
  maxDuration: HEARTBEAT.BUSY_TTL,
  run: async (_, { ctx, signal }) => {
    if (await isBusy()) {
      await runs.cancel(ctx.run.id)
      if (!signal.aborted) {
        await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }))
      }
      return
    }

    if (await isLifeEventActive()) {
      log.info("Heartbeat skipped — life event active")
      await runs.cancel(ctx.run.id)
      if (!signal.aborted) {
        await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }))
      }
      return
    }

    const [emotion, waitingSince, peek] = await Promise.all([
      getCurrentEmotion(),
      getConversationWaitingSince(),
      fetchNewMessages(0)
    ])

    if (!waitingSince && peek.messages.length === 0) {
      const lifeEvent = await maybeStartLifeEvent()
      if (lifeEvent) {
        log.info("Heartbeat skipped — new life event started")
        await runs.cancel(ctx.run.id)
        if (!signal.aborted) {
          await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }))
        }
        return
      }
    }

    if (emotion) {
      const skip = await computeSkipProbability(emotion, waitingSince !== null, peek.messages.length > 0)
      if (Math.random() < skip) {
        log.info("Heartbeat gated", { skipProbability: skip.toFixed(2) })
        await runs.cancel(ctx.run.id)
        if (!signal.aborted) {
          await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }))
        }
        return
      }
    }

    return runHeartbeat()
  }
})
