import { differenceInDays, differenceInMinutes, parseISO } from "date-fns"
import { computeRelationshipPhase, shouldTransitionPhase } from "@/attachment/phases.ts"
import {
  getAttachmentStyle,
  getConflictCount,
  getFirstInteractionAt,
  getPhaseTickCount,
  getRelationshipPhase,
  getTotalInteractions,
  incrementConflictCount,
  incrementPhaseTickCount,
  saveAttachmentStyle,
  saveRelationshipPhase
} from "@/attachment/state.ts"
import { detectConflict, hasStyleChanged, updateAttachmentStyle } from "@/attachment/update.ts"
import {
  applyIdiolectDrift,
  detectOperatorAdoption,
  extractPatterns,
  getIdiolectState,
  mergePatterns,
  saveIdiolectState
} from "@/communication/idiolect.ts"
import { MOMENTUM } from "@/config/constants.ts"
import { getMoodBaseline, saveMoodBaseline } from "@/emotion/state.ts"
import { clampState } from "@/emotion/update.ts"
import { log } from "@/lib/logger.ts"
import { logAndCaptureError } from "@/lib/result.ts"
import { applyOpinionDrift } from "@/memory/semantic.ts"
import {
  getLastTickSummary,
  incrementConsecutiveConversationTicks,
  incrementConsecutiveIdleTicks,
  resetConsecutiveConversationTicks,
  resetConsecutiveIdleTicks
} from "@/memory/working.ts"
import { handleDriftCheck } from "@/security/guardian.ts"
import { getSomaticState, saveSomaticState } from "@/soma/state.ts"
import { rechargeSocialBattery } from "@/soma/update.ts"
import { logActionResult, logTick } from "./recorder.ts"
import type { DeliberateResult, FeelingResult, MaintainInput, TickSummary } from "./types.ts"

const OPINION_DRIFT_PROBABILITY = 0.05
const IDIOLECT_DRIFT_PROBABILITY = 0.05

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

  const isRestingAction =
    (input.decision.action === "idle" || input.decision.action === "dream") && !input.actResult.responseSent

  if (isRestingAction) {
    await Promise.all([incrementConsecutiveIdleTicks(), resetConsecutiveConversationTicks()])

    const currentSoma = await getSomaticState()
    const isDreaming = input.senseResult.moodContext.isDreaming || input.decision.action === "dream"
    const rechargedSoma = rechargeSocialBattery(currentSoma, isDreaming)
    if (rechargedSoma.socialBattery !== currentSoma.socialBattery) {
      await saveSomaticState(rechargedSoma, "social_battery_recharge")
    }
  } else {
    const inConversation = input.senseResult.moodContext.inConversation
    await Promise.all([
      resetConsecutiveIdleTicks(),
      inConversation ? incrementConsecutiveConversationTicks() : resetConsecutiveConversationTicks()
    ])
  }

  const oldBaseline = await getMoodBaseline()
  const alpha = MOMENTUM.MOOD_BASELINE_ALPHA
  const newBaseline = clampState({
    curiosity: alpha * feelResult.emotion.curiosity + (1 - alpha) * oldBaseline.curiosity,
    satisfaction: alpha * feelResult.emotion.satisfaction + (1 - alpha) * oldBaseline.satisfaction,
    frustration: alpha * feelResult.emotion.frustration + (1 - alpha) * oldBaseline.frustration,
    boredom: alpha * feelResult.emotion.boredom + (1 - alpha) * oldBaseline.boredom,
    excitement: alpha * feelResult.emotion.excitement + (1 - alpha) * oldBaseline.excitement,
    caution: alpha * feelResult.emotion.caution + (1 - alpha) * oldBaseline.caution,
    connection: alpha * feelResult.emotion.connection + (1 - alpha) * oldBaseline.connection,
    confidence: alpha * feelResult.emotion.confidence + (1 - alpha) * oldBaseline.confidence,
    energy: alpha * feelResult.emotion.energy + (1 - alpha) * oldBaseline.energy
  })
  await saveMoodBaseline(newBaseline)

  if (Math.random() < OPINION_DRIFT_PROBABILITY) {
    const driftResult = await applyOpinionDrift()
    if (driftResult.isErr()) logAndCaptureError(driftResult.error)
  }

  const idiolectState = await getIdiolectState()
  const operatorTexts = input.senseResult.pendingMessages.map((m) => m.text || "")
  const animaTexts = input.decision.messages.map((m) => m.text)

  const selfPatterns = animaTexts.length > 0 ? extractPatterns(animaTexts) : []
  const adoptedPatterns = operatorTexts.length > 0 ? detectOperatorAdoption(operatorTexts, idiolectState) : []
  const allNewPatterns = [...selfPatterns, ...adoptedPatterns]

  if (allNewPatterns.length > 0) {
    const merged = mergePatterns(idiolectState, allNewPatterns)
    await saveIdiolectState(merged)
  } else if (Math.random() < IDIOLECT_DRIFT_PROBABILITY) {
    const drifted = applyIdiolectDrift(idiolectState)
    await saveIdiolectState(drifted)
  }

  const durationMs = Date.now() - input.startTime
  const tickSummary = await logTick(input, durationMs, feelResult.emotion)
  await logActionResult(input.decision, deliberateResult)

  log.info("Tick complete", tickSummary)

  return tickSummary
}
