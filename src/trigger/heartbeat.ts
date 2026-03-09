import { runs, schedules } from "@trigger.dev/sdk"
import { HEARTBEAT } from "@/config/constants.ts"
import { computeSkipProbability, consumeBurstCooldownTick } from "@/consciousness/gating.ts"
import { runHeartbeat } from "@/consciousness/heartbeat.ts"
import {
  getActiveLifeEvent,
  isLifeEventActive,
  maybeStoreLifecycleEpisode,
  sendLifecycleNotification
} from "@/consciousness/lifecycle.ts"
import { fetchNewMessages } from "@/integrations/telegram.ts"
import { log } from "@/lib/logger.ts"
import { captureError } from "@/lib/sentry.ts"
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
      log.info("Heartbeat skipped — busy")
      await runs.cancel(ctx.run.id)
      if (!signal.aborted) {
        await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }))
      }
      return
    }

    if (await isLifeEventActive()) {
      const event = await getActiveLifeEvent()
      if (event?.interruptible) {
        const peek = await fetchNewMessages(0)
        if (peek.messages.length > 0 && Math.random() < 0.3) {
          sendLifecycleNotification(event.type, "mid_event").catch((e) => captureError(e, { phase: "lifecycle_mid_event" }))
        }
      }
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

    if (emotion) {
      const skip = await computeSkipProbability(emotion, waitingSince !== null, peek.messages.length > 0)
      if (Math.random() < skip) {
        await consumeBurstCooldownTick()
        log.info("Heartbeat gated", { skipProbability: skip.toFixed(2) })
        await runs.cancel(ctx.run.id)
        if (!signal.aborted) {
          await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }))
        }
        return
      }
    }

    await maybeStoreLifecycleEpisode()

    return runHeartbeat()
  }
})
