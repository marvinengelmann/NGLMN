import { schedules } from "@trigger.dev/sdk"
import { runHealthCheck } from "@/health/check.ts"

export const healthTask = schedules.task({
  id: "health",
  cron: "*/15 * * * *",
  run: async () => runHealthCheck()
})
