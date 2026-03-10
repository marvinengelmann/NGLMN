import { differenceInDays, differenceInMinutes, parseISO } from "date-fns"
import { MOMENTUM } from "@/affect/emotion/constants.ts"
import { getMoodBaseline, saveMoodBaseline } from "@/affect/emotion/state.ts"
import { clampState } from "@/affect/emotion/update.ts"
import { getSomaticState, saveSomaticState } from "@/affect/soma/state.ts"
import { rechargeSocialBattery } from "@/affect/soma/update.ts"
import { updateHabitState } from "@/cognition/habit.ts"
import { getHabitState, saveHabitState } from "@/cognition/habits.ts"
import {
  applyIdiolectDrift,
  detectOperatorAdoption,
  extractPatterns,
  getIdiolectState,
  mergePatterns,
  saveIdiolectState
} from "@/expression/communication/idiolect.ts"
import { handleDriftCheck } from "@/governance/security/guardian.ts"
import { log } from "@/infra/lib/logger.ts"
import { logAndCaptureError } from "@/infra/lib/result.ts"
import { addKeyMoment, getRelationalMemoryState, saveRelationalMemoryState } from "@/memory/relational.ts"
import { applyOpinionDrift } from "@/memory/semantic.ts"
import {
  getLastTickSummary,
  getRecentActions,
  incrementConsecutiveConversationTicks,
  incrementConsecutiveIdleTicks,
  resetConsecutiveConversationTicks,
  resetConsecutiveIdleTicks
} from "@/memory/working.ts"
import { computeRelationshipPhase, shouldTransitionPhase } from "@/relational/attachment/phases.ts"
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
} from "@/relational/attachment/state.ts"
import { detectConflict, hasStyleChanged, updateAttachmentStyle } from "@/relational/attachment/update.ts"
import { formBoundary } from "@/self/boundaries/compute.ts"
import { BOUNDARIES } from "@/self/boundaries/constants.ts"
import { getBoundaryState, saveBoundaryState } from "@/self/boundaries/state.ts"
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

  const previousHabitState = await getHabitState()
  const recentActionsForHabit = await getRecentActions()
  const habitState = updateHabitState(previousHabitState, recentActionsForHabit, input.decision.action)
  await saveHabitState(habitState)

  if (input.actResult.responseSent && input.senseResult.pendingMessages.length > 0) {
    const relationalState = await getRelationalMemoryState()

    if (feelResult.emotion.connection > 0.7) {
      const updated = addKeyMoment(
        relationalState,
        `${input.decision.action}: ${input.decision.reasoning.slice(0, 100)}`,
        feelResult.emotion.connection
      )
      await saveRelationalMemoryState(updated)
    }
  }

  const negativeEmotionalPressure = (feelResult.emotion.frustration + feelResult.emotion.caution) / 2
  if (
    negativeEmotionalPressure > BOUNDARIES.FORMATION_NEGATIVE_THRESHOLD &&
    input.senseResult.pendingMessages.length > 0
  ) {
    const boundaryState = await getBoundaryState()
    if (boundaryState.boundaries.length < BOUNDARIES.MAX_BOUNDARIES) {
      const triggerText = input.senseResult.pendingMessages
        .map((m) => m.text)
        .join(" ")
        .slice(0, 100)
      const newBoundary = formBoundary(
        "emotional",
        `negative pattern: high frustration/caution during interaction`,
        triggerText
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 4)
          .slice(0, 3)
          .join("|"),
        `maintain_phase: frustration=${feelResult.emotion.frustration.toFixed(2)} caution=${feelResult.emotion.caution.toFixed(2)}`
      )
      await saveBoundaryState({
        ...boundaryState,
        boundaries: [...boundaryState.boundaries, newBoundary]
      })
      log.info("Boundary formed from negative pattern", { boundaryId: newBoundary.id })
    }
  }

  const durationMs = Date.now() - input.startTime
  const tickSummary = await logTick(input, durationMs, feelResult.emotion)
  await logActionResult(input.decision, deliberateResult)

  log.info("Tick complete", tickSummary)

  return tickSummary
}
