import { differenceInDays, differenceInMinutes, parseISO } from "date-fns"
import { detectConflict } from "@/attachment/conflict.ts"
import { computeRelationshipPhase, shouldTransitionPhase } from "@/attachment/phases.ts"
import {
  getAttachmentStyle,
  getPhaseTickCount,
  getRelationshipPhase,
  incrementPhaseTickCount,
  saveAttachmentStyle,
  saveRelationshipPhase
} from "@/attachment/state.ts"
import { hasStyleChanged, updateAttachmentStyle } from "@/attachment/update.ts"
import { log } from "@/lib/logger.ts"
import {
  getConflictCount,
  getFirstInteractionAt,
  getLastTickSummary,
  getTotalInteractions,
  incrementConflictCount,
  incrementConsecutiveIdleTicks,
  resetConsecutiveIdleTicks
} from "@/memory/working.ts"
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
  const lastTick = await getLastTickSummary()
  const elapsedHours = lastTick ? differenceInMinutes(new Date(), parseISO(lastTick.timestamp)) / 60 : 1 / 60
  const updatedStyle = updateAttachmentStyle(currentStyle, feelResult.attachmentDynamics, elapsedHours)

  if (hasStyleChanged(currentStyle, updatedStyle)) {
    await saveAttachmentStyle(updatedStyle)
  }

  const [currentPhase, phaseTickCount, conflictCount, firstInteractionAt, totalInteractions] = await Promise.all([
    getRelationshipPhase(),
    getPhaseTickCount(),
    getConflictCount(),
    getFirstInteractionAt(),
    getTotalInteractions()
  ])

  const daysSinceFirst = firstInteractionAt ? differenceInDays(new Date(), parseISO(firstInteractionAt)) : 0

  const isConflict = detectConflict({
    operatorMood: feelResult.operatorModel.estimatedMood,
    modelConfidence: feelResult.operatorModel.modelConfidence,
    dissonanceScore: feelResult.dissonance.activeDissonance,
    guardianBlocked: false
  })
  if (isConflict) {
    await incrementConflictCount()
  }

  const effectiveConflictCount = isConflict ? conflictCount + 1 : conflictCount

  const computedPhase = computeRelationshipPhase({
    interactionCount: totalInteractions,
    daysSinceFirst,
    connectionAvg: feelResult.emotion.connection,
    conflicts: effectiveConflictCount,
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
  const tickSummary = await logTick(input, durationMs, feelResult.emotion)
  await logActionResult(input.decision, deliberateResult)

  log.info("Tick complete", tickSummary)

  return tickSummary
}
