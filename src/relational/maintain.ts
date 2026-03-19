import { differenceInDays, differenceInMinutes, parseISO } from "date-fns"
import { DEFAULT_METACOGNITIVE_STATE } from "@/cognition/types.ts"
import type { FeelingResult } from "@/consciousness/types.ts"
import type { TickSummary } from "@/core/types.ts"
import type { WriteBuffer } from "@/infra/lib/buffer.ts"
import { log } from "@/infra/lib/logger.ts"
import { runProbabilisticTasks } from "@/infra/lib/probabilistic.ts"
import { evaluateAttachmentCrisis, getCrisisState, saveCrisisState } from "@/relational/attachment/crisis.ts"
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
  saveRelationshipPhase
} from "@/relational/attachment/state.ts"
import {
  computeTrustDelta,
  detectConflict,
  hasStyleChanged,
  updateAttachmentStyle
} from "@/relational/attachment/update.ts"
import { maybeUpdateProfile } from "@/relational/mind/profiling.ts"
import {
  decayActivePattern,
  maybeFormTemplate,
  updatePatternAwareness,
  updateTemplateStrength
} from "@/relational/patterns/compute.ts"
import { RELATIONAL_PATTERN } from "@/relational/patterns/constants.ts"
import { getRelationalPatternState, saveRelationalPatternState } from "@/relational/patterns/state.ts"

const REDIS_ATTACHMENT_STYLE = "working:attachment:current"

const PROBABILITIES = {
  DEEP_PROFILE_UPDATE: 0.05
} as const

/**
 * Maintain attachment style, relationship phase, relational patterns, and operator profile.
 */
export async function maintainRelational(
  feelResult: FeelingResult,
  lastTick: TickSummary | null,
  buffer: WriteBuffer
): Promise<void> {
  await maintainAttachment(feelResult, lastTick, buffer)
  await maintainRelationship(feelResult, buffer)

  await runProbabilisticTasks([
    {
      name: "pattern_maintenance",
      probability: 1,
      execute: async () => {
        let state = await getRelationalPatternState()

        if (Math.random() < RELATIONAL_PATTERN.TEMPLATE_FORMATION_PROBABILITY) {
          const patterns = feelResult.relationalPatterns?.patterns ?? []
          const newTemplate = maybeFormTemplate(patterns, state.templates)
          if (newTemplate) {
            state = {
              ...state,
              templates: [...state.templates, newTemplate].slice(-RELATIONAL_PATTERN.MAX_TEMPLATES)
            }
          }
        }

        const decayed = decayActivePattern(state)
        const updatedTemplates = updateTemplateStrength(decayed.templates, decayed.activePattern?.templateId ?? null)
        const awareness = updatePatternAwareness(
          decayed.awarenessLevel,
          !!decayed.activePattern,
          feelResult.metacognitiveState?.cognitiveClarity ?? DEFAULT_METACOGNITIVE_STATE.cognitiveClarity
        )
        await saveRelationalPatternState({ ...decayed, templates: updatedTemplates, awarenessLevel: awareness }, buffer)
      }
    },
    {
      name: "deep_profile_update",
      probability: PROBABILITIES.DEEP_PROFILE_UPDATE,
      execute: () => maybeUpdateProfile(feelResult.operatorModel.moodHistory)
    }
  ])
}

async function maintainAttachment(
  feelResult: FeelingResult,
  lastTick: TickSummary | null,
  buffer: WriteBuffer
): Promise<void> {
  const currentStyle = await getAttachmentStyle()
  const elapsedHours = lastTick ? differenceInMinutes(new Date(), parseISO(lastTick.timestamp)) / 60 : 1 / 60

  const previousCrisis = await getCrisisState()
  const trustDelta = computeTrustDelta(feelResult.emotion)
  const crisisResult = evaluateAttachmentCrisis(previousCrisis, {
    dynamics: feelResult.attachmentDynamics,
    emotion: feelResult.emotion,
    trustDelta,
    vulnerabilityOpen: feelResult.vulnerability.windowOpen
  })
  if (crisisResult.active !== previousCrisis.active || crisisResult.type !== previousCrisis.type) {
    await saveCrisisState(crisisResult, buffer)
    if (crisisResult.active) {
      log.info("Attachment crisis detected", { type: crisisResult.type, multiplier: crisisResult.multiplier })
    }
  }

  const crisisMultiplier = crisisResult.active ? crisisResult.multiplier : 1
  const updatedStyle = updateAttachmentStyle(
    currentStyle,
    feelResult.attachmentDynamics,
    elapsedHours,
    crisisMultiplier
  )

  if (hasStyleChanged(currentStyle, updatedStyle)) {
    buffer.stage(REDIS_ATTACHMENT_STYLE, updatedStyle)
  }
}

async function maintainRelationship(feelResult: FeelingResult, buffer: WriteBuffer): Promise<void> {
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

  const attachmentStyle = await getAttachmentStyle()
  const computedPhase = computeRelationshipPhase({
    interactionCount: totalInteractions,
    daysSinceFirst,
    connectionAvg: feelResult.emotion.connection,
    conflicts: effectiveConflictCount,
    trust: attachmentStyle.secure,
    attachmentSecurity: attachmentStyle.secure,
    currentPhase
  })

  if (shouldTransitionPhase(currentPhase, computedPhase, phaseTickCount)) {
    await saveRelationshipPhase(computedPhase, currentPhase, "maintain_transition", buffer)
    log.info("Relationship phase transition", { from: currentPhase, to: computedPhase })
  } else {
    await incrementPhaseTickCount()
  }
}
