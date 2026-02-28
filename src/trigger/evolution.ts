import { task } from "@trigger.dev/sdk"
import type { EvolutionType } from "@/evolution/changelog.ts"
import { runEvolution } from "@/evolution/orchestrator.ts"

export const evolutionTask = task({
  id: "evolution",
  queue: {
    concurrencyLimit: 1
  },
  run: async (payload: { type: EvolutionType; promptId?: string; insight?: string; capabilityGap?: string }) =>
    runEvolution(payload)
})
