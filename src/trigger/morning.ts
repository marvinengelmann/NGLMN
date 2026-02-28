import { schedules } from "@trigger.dev/sdk"
import { TIMEZONE } from "@/lib/time.ts"
import { runMorningRoutine } from "@/routine/morning.ts"

export const morningTask = schedules.task({
  id: "morning",
  cron: {
    pattern: "0 9 * * *",
    timezone: TIMEZONE
  },
  queue: {
    concurrencyLimit: 1
  },
  run: async () => runMorningRoutine()
})
