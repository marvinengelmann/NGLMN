import {
  getAttachmentStyle,
  getPhaseTickCount,
  getRelationshipPhase,
  incrementPhaseTickCount,
  saveAttachmentStyle,
  saveRelationshipPhase
} from "@/attachment/state.ts"
import { computeRelationshipPhase, shouldTransitionPhase } from "@/attachment/phases.ts"
import { hasStyleChanged, updateAttachmentStyle } from "@/attachment/update.ts"
import { log } from "@/lib/logger.ts"
import { incrementConsecutiveIdleTicks, resetConsecutiveIdleTicks } from "@/memory/working.ts"
import { handleDriftCheck } from "@/security/guardian.ts"
import { logActionResult, logTick } from "./recorder.ts"
import type { DeliberateResult, FeelingResult, MaintainInput, TickSummary } from "./types.ts"

/**
 * MAINTAIN phase — persist state, detect drift, update attachment, track phases and idle ticks.
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

  const [currentPhase, phaseTickCount] = await Promise.all([
    getRelationshipPhase(),
    getPhaseTickCount()
  ])

  const computedPhase = computeRelationshipPhase({
    interactionCount: input.senseResult.pendingMessages.length,
    daysSinceFirst: 0,
    connectionAvg: input.senseResult.emotion.connection,
    conflicts: 0,
    trust: updatedStyle.secure,
    attachmentSecurity: updatedStyle.secure,
    currentPhase
  })

  if (shouldTransitionPhase(currentPhase, computedPhase, phaseTickCount)) {
    await saveRelationshipPhase(computedPhase, currentPhase, `maintain_transition`)
    log.info("Relationship phase transition", { from: currentPhase, to: computedPhase })
  } else {
    await incrementPhaseTickCount()
  }

  if (input.decision.action === "idle" && !input.actResult.responseSent) {
    await incrementConsecutiveIdleTicks()
  } else {
    await resetConsecutiveIdleTicks()
  }

  const durationMs = Date.now() - input.startTime
  const tickSummary = await logTick(input, durationMs)
  await logActionResult(input.decision, deliberateResult)

  log.info("Tick complete", tickSummary)

  return tickSummary
}
