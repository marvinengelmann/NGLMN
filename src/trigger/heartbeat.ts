import { runs, schedules } from "@trigger.dev/sdk"
import { getCurrentEmotion } from "@/affect/emotion/state.ts"
import { computeSkipProbability, consumeBurstCooldownTick } from "@/consciousness/gating.ts"
import { runHeartbeat } from "@/consciousness/heartbeat.ts"
import { getConversationWaitingSince } from "@/expression/communication/state.ts"
import { HEARTBEAT } from "@/infra/config/constants.ts"
import { fetchNewMessages } from "@/infra/integrations/telegram.ts"
import { log } from "@/infra/lib/logger.ts"
import { isBusy } from "@/memory/working.ts"
import {
  getActiveLifeEvent,
  handleMidEventCheck,
  isLifeEventActive,
  maybeStoreLifecycleEpisode
} from "@/self/lifecycle.ts"

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
      if (event) {
        const peek = await fetchNewMessages(0)
        if (peek.messages.length > 0) {
          await handleMidEventCheck(event, peek.maxUpdateId)
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
