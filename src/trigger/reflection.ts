import { task } from "@trigger.dev/sdk"
import { formatISO } from "date-fns"
import { db } from "@/db/client.ts"
import { dreamLog } from "@/db/schema.ts"
import { buildReflectionInput, performReflection } from "@/dream/reflection.ts"
import { log } from "@/lib/logger.ts"
import { captureError } from "@/lib/sentry.ts"
import { setReflectionLastAt } from "@/memory/working.ts"

export const adHocReflectionTask = task({
  id: "reflection",
  queue: {
    concurrencyLimit: 1
  },
  run: async (payload: { reason: string }) => {
    log.info("Starting ad-hoc reflection", { reason: payload.reason })

    try {
      const input = await buildReflectionInput()
      const output = await performReflection(input)

      await setReflectionLastAt(formatISO(new Date()))

      await db.insert(dreamLog).values({
        phase: "ad_hoc_reflection",
        summary: `Ad-hoc reflection (${payload.reason}): ${output.insights.length} insights.`,
        insights: output
      })

      log.info("Ad-hoc reflection complete", {
        insights: output.insights.length,
        goals: output.newGoals?.length ?? 0
      })

      return { reason: payload.reason, output }
    } catch (e) {
      captureError(e, { phase: "ad_hoc_reflection", reason: payload.reason })
      log.error("Ad-hoc reflection failed", { error: String(e) })
      return { reason: payload.reason, error: String(e) }
    }
  }
})
