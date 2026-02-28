import { schedules } from "@trigger.dev/sdk"
import { runBridgeCycle } from "@/bridge/cycle.ts"

export const bridgeTask = schedules.task({
  id: "bridge",
  cron: "*/1 * * * *",
  queue: {
    concurrencyLimit: 1
  },
  maxDuration: 600,
  run: async () => runBridgeCycle()
})
