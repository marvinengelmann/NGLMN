import { task } from "@trigger.dev/sdk"
import { runReflection } from "@/routine/reflection.ts"

export const adHocReflectionTask = task({
  id: "reflection",
  queue: {
    concurrencyLimit: 1
  },
  run: async (payload: { reason: string }) => runReflection(payload.reason)
})
