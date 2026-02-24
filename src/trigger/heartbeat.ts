import { schedules } from "@trigger.dev/sdk"
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

/**
 * Core heartbeat loop — runs every 5 minutes via cron schedule.
 * Orchestrates SENSE → THINK → ACT → MAINTAIN phases.
 */
export const heartbeatTask = schedules.task({
  id: "heartbeat",
  cron: "*/5 * * * *",
  queue: {
    concurrencyLimit: 1
  },
  run: async () => {
    const hour = getHours(nowLocal())
    if (hour < 6) {
      log.info("Dream hours, skipping heartbeat", { hour })
      return { skipped: true, reason: "dream_hours" }
    }

    const ctx: TickContext = {
      tickId: `tick-${Date.now()}`,
      startTime: Date.now(),
      timestamp: formatISO(new Date())
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
})
