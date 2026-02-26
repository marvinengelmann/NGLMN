import { schedules } from "@trigger.dev/sdk"
import { sendMorningMessage } from "@/dream/morning.ts"
import { metricsRecalibration, morningRecalibration } from "@/emotion/calibration.ts"
import { collectMetrics } from "@/emotion/metrics-check.ts"
import { getEmotionalState, saveEmotionalState } from "@/emotion/state.ts"
import { log } from "@/lib/logger.ts"
import { captureError } from "@/lib/sentry.ts"
import { TIMEZONE } from "@/lib/time.ts"
import { setDreamState } from "@/memory/working.ts"

export const morningTask = schedules.task({
  id: "morning",
  cron: {
    pattern: "0 9 * * *",
    timezone: TIMEZONE
  },
  queue: {
    concurrencyLimit: 1
  },
  run: async () => {
    log.info("Starting morning routine")
    let emotion: Record<string, number> | null = null

    try {
      const [currentEmotion, metrics] = await Promise.all([getEmotionalState(), collectMetrics()])

      const afterMetrics = metricsRecalibration(currentEmotion, metrics)
      const afterMorning = morningRecalibration(afterMetrics)
      emotion = afterMorning

      await saveEmotionalState(afterMorning, "tick_start")
      log.info("Emotional recalibration complete", { before: currentEmotion, after: afterMorning })
    } catch (e) {
      log.error("Morning recalibration failed", { error: String(e) })
      captureError(e, { phase: "morning_recalibration" })
    }

    try {
      await sendMorningMessage()
      log.info("Morning message sent")
    } catch (e) {
      log.error("Morning message failed", { error: String(e) })
      captureError(e, { phase: "morning_message" })
    } finally {
      await setDreamState("idle")
      log.info("Dream state reset to idle")
    }

    return { action: "completed", emotion }
  }
})
