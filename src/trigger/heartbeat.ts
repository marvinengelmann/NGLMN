import { schedules, task } from "@trigger.dev/sdk"
import { runHeartbeat } from "@/core/heartbeat.ts"

/**
 * Standalone heartbeat task — can be triggered programmatically (e.g. from conversation handler).
 */
export const heartbeatRunTask = task({
  id: "heartbeat-run",
  queue: {
    concurrencyLimit: 1
  },
  maxDuration: 300,
  run: async (payload: { skipDreamCheck?: boolean; actionRequested?: boolean }) =>
    runHeartbeat(payload.skipDreamCheck, payload.actionRequested)
})

/**
 * Scheduled heartbeat — runs every 5 minutes via cron.
 */
export const heartbeatTask = schedules.task({
  id: "heartbeat",
  cron: "*/5 * * * *",
  queue: {
    concurrencyLimit: 1
  },
  run: () => runHeartbeat()
})
