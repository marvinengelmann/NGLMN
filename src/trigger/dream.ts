import { schedules } from "@trigger.dev/sdk"
import { runDreamCycle } from "@/dream/orchestrator.ts"
import { TIMEZONE } from "@/lib/time.ts"

export const dreamTask = schedules.task({
  id: "dream",
  cron: {
    pattern: "0 3 * * *",
    timezone: TIMEZONE
  },
  queue: {
    concurrencyLimit: 1
  },
  run: async () => runDreamCycle()
})
