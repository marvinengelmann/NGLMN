import { task } from "@trigger.dev/sdk"
import { db } from "@/db/client.ts"
import { dreamLog } from "@/db/schema.ts"
import { performMiniReflection, shouldTriggerReflection } from "@/dream/reflection.ts"
import { log } from "@/lib/logger.ts"
import { captureError } from "@/lib/sentry.ts"

export const adHocReflectionTask = task({
  id: "reflection",
  queue: {
    concurrencyLimit: 1
  },
  run: async (payload: { failures: number; rollbacks: number; budgetPercent: number }) => {
    const check = shouldTriggerReflection(payload)

    if (!check.trigger) {
      log.info("Ad-hoc reflection not needed", { reason: check.reason })
      return { triggered: false, reason: check.reason }
    }

    log.info("Starting ad-hoc reflection", { reason: check.reason })

    try {
      const output = await performMiniReflection(check.reason)

      await db.insert(dreamLog).values({
        phase: "ad_hoc_reflection",
        summary: `Ad-hoc reflection triggered: ${check.reason}. Generated ${output.insights.length} insights.`,
        insights: output
      })

      log.info("Ad-hoc reflection complete", {
        insights: output.insights.length,
        goals: output.newGoals?.length ?? 0
      })

      return { triggered: true, reason: check.reason, output }
    } catch (e) {
      captureError(e, { phase: "ad_hoc_reflection", reason: check.reason })
      log.error("Ad-hoc reflection failed", { error: String(e) })
      return { triggered: true, reason: check.reason, error: String(e) }
    }
  }
})
