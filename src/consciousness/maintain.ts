import { log } from "@/lib/logger.ts"
import { handleDriftCheck } from "@/security/guardian.ts"
import { logActionResult, logTick } from "./recorder.ts"
import type { MaintainInput, ThinkResult, TickSummary } from "./types.ts"

/**
 * MAINTAIN phase — persist state, detect drift, save final emotion.
 * Also logs dream entries when action is dream or morning.
 */
export async function maintain(input: MaintainInput, thinkResult: ThinkResult): Promise<TickSummary> {
  await handleDriftCheck()

  const durationMs = Date.now() - input.startTime
  const tickSummary = await logTick(input, durationMs)
  await logActionResult(input.decision, thinkResult)

  log.info("Tick complete", tickSummary)

  return tickSummary
}
