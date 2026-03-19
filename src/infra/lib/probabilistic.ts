import { log } from "@/infra/lib/logger.ts"
import { captureError } from "@/infra/lib/sentry.ts"

interface ProbabilisticTask {
  name: string
  probability: number
  condition?: boolean
  execute: () => Promise<unknown>
}

/**
 * Run a list of probabilistic tasks, skipping those whose condition is false or whose random check fails.
 */
export async function runProbabilisticTasks(tasks: ProbabilisticTask[]): Promise<void> {
  for (const task of tasks) {
    if (task.condition === false) continue
    if (task.probability < 1 && Math.random() >= task.probability) continue
    try {
      await task.execute()
    } catch (e) {
      log.warn(`Probabilistic task failed: ${task.name}`, { error: String(e) })
      captureError(e, { phase: "maintain_probabilistic", task: task.name })
    }
  }
}
