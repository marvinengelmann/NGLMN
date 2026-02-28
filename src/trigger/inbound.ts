import { schedules } from "@trigger.dev/sdk"
import { runInboundCycle } from "@/inbound/cycle.ts"

export const inboundTask = schedules.task({
  id: "inbound",
  cron: "*/5 * * * *",
  queue: { concurrencyLimit: 1 },
  run: async () => runInboundCycle()
})
