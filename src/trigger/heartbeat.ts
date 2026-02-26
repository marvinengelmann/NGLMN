import { schedules, task } from "@trigger.dev/sdk"
import { formatISO, getHours } from "date-fns"
import { act } from "@/core/phases/act.ts"
import { maintain } from "@/core/phases/maintain.ts"
import type { TickContext } from "@/core/phases/sense.ts"
import { sense } from "@/core/phases/sense.ts"
import { think } from "@/core/phases/think.ts"
import { log } from "@/lib/logger.ts"
import { setTickContext } from "@/lib/sentry.ts"
import { nowLocal } from "@/lib/time.ts"
import { isTickRunning, setTickRunning } from "@/memory/working.ts"

async function executeHeartbeat(skipDreamCheck = false, actionRequested = false) {
  const hour = getHours(nowLocal())
  if (hour < 6 && !skipDreamCheck) {
    log.info("Dream hours, skipping heartbeat", { hour })
    return { skipped: true, reason: "dream_hours" }
  }

  const ctx: TickContext = {
    tickId: `tick-${Date.now()}`,
    startTime: Date.now(),
    timestamp: formatISO(new Date()),
    actionRequested
  }
  setTickContext({ tickId: ctx.tickId })

  if (await isTickRunning()) {
    log.warn("Tick already running, skipping")
    return { skipped: true }
  }

  await setTickRunning(true)

  try {
    const senseResult = await sense(ctx)
    const thinkResult = await think(ctx, senseResult)
    const actResult = await act(ctx, senseResult, thinkResult)
    return await maintain(ctx, thinkResult, actResult)
  } finally {
    await setTickRunning(false)
  }
}

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
    executeHeartbeat(payload.skipDreamCheck, payload.actionRequested)
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
  run: () => executeHeartbeat()
})
