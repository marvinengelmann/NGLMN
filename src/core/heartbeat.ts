import { act } from "@/core/phases/act.ts"
import { maintain } from "@/core/phases/maintain.ts"
import type { TickContext } from "@/core/phases/sense.ts"
import { sense } from "@/core/phases/sense.ts"
import { think } from "@/core/phases/think.ts"
import { log } from "@/lib/logger.ts"
import { setTickContext } from "@/lib/sentry.ts"
import { isDreamTime, nowISO } from "@/lib/time.ts"
import { isTickRunning, setLastTickSummary, setTickRunning } from "@/memory/working.ts"

export async function runHeartbeat(skipDreamCheck = false, actionRequested = false) {
  if (isDreamTime() && !skipDreamCheck) {
    log.info("Dream hours, skipping heartbeat")
    await setLastTickSummary({
      tickId: `tick-${Date.now()}`,
      timestamp: nowISO(),
      triageDecision: "idle",
      triageReason: "dream_hours",
      messagesProcessed: 0,
      responseSent: false,
      durationMs: 0
    })
    return { skipped: true, reason: "dream_hours" }
  }

  const ctx: TickContext = {
    tickId: `tick-${Date.now()}`,
    startTime: Date.now(),
    timestamp: nowISO(),
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
