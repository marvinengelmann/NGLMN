import { getAttachmentStyle, saveAttachmentStyle } from "@/attachment/state.ts"
import { hasStyleChanged, updateAttachmentStyle } from "@/attachment/update.ts"
import { log } from "@/lib/logger.ts"
import { handleDriftCheck } from "@/security/guardian.ts"
import { logActionResult, logTick } from "./recorder.ts"
import type { DeliberateResult, FeelingResult, MaintainInput, TickSummary } from "./types.ts"

/**
 * MAINTAIN phase — persist state, detect drift, update attachment.
 */
export async function maintain(
  input: MaintainInput,
  deliberateResult: DeliberateResult,
  feelResult: FeelingResult
): Promise<TickSummary> {
  await handleDriftCheck()

  const currentStyle = await getAttachmentStyle()
  const elapsedHours = 1 / 60
  const updatedStyle = updateAttachmentStyle(currentStyle, feelResult.attachmentDynamics, elapsedHours)

  if (hasStyleChanged(currentStyle, updatedStyle)) {
    await saveAttachmentStyle(updatedStyle)
  }

  const durationMs = Date.now() - input.startTime
  const tickSummary = await logTick(input, durationMs)
  await logActionResult(input.decision, deliberateResult)

  log.info("Tick complete", tickSummary)

  return tickSummary
}
