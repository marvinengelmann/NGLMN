import { runs, schedules } from "@trigger.dev/sdk"
import { HEARTBEAT } from "@/config/constants.ts"
import { runHeartbeat } from "@/consciousness/heartbeat.ts"
import { isBusy } from "@/memory/working.ts"

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
        await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve()))
      }
      return
    }

    return runHeartbeat()
  }
})
