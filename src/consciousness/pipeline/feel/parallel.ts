import type { EmotionalState, EmotionUpdateEvent } from "@/affect/emotion/types.ts"
import type { SomaticState } from "@/affect/soma/types.ts"
import { computeInstinctImpression } from "@/cognition/instinct.ts"
import { updateAnticipatoryState } from "@/perception/anticipation/compute.ts"
import { updateNoveltyState } from "@/perception/novelty/compute.ts"
import {
  computeWaitingPerception,
  evaluateAttachmentDynamics,
  isOperatorReturning
} from "@/relational/attachment/update.ts"
import { extractSignals, learnFromObservation } from "@/relational/mind/triggers.ts"
import { detectModelCorrection, updateOperatorModel } from "@/relational/mind/update.ts"
import { updateBoundaryState } from "@/self/boundaries/compute.ts"
import { checkDissonanceWithCooldown } from "@/self/dissonance/compute.ts"
import type { SenseResult } from "../../types.ts"
import type { FeelPrefetch, ParallelFanResult } from "./types.ts"

export async function runParallelSubsystems(
  emotion: EmotionalState,
  soma: SomaticState,
  sense: SenseResult,
  prefetch: FeelPrefetch
): Promise<ParallelFanResult> {
  const operatorSilenceMinutes = sense.moodContext.operatorSilenceMinutes
  const messageTexts = sense.pendingMessages.map((m) => m.text)
  const messageTimestamps = sense.pendingMessages.map((m) => new Date(m.date * 1000).toISOString())

  const [
    instinctResult,
    dissonanceResult,
    operatorModelResult,
    attachmentResult,
    anticipationResult,
    noveltyResult,
    boundaryResult
  ] = await Promise.all([
    runInstinct(sense, emotion, soma),
    runDissonance(emotion, prefetch),
    runOperatorModel(messageTexts, messageTimestamps, operatorSilenceMinutes, prefetch),
    runAttachment(emotion, operatorSilenceMinutes, sense, prefetch),
    runAnticipation(sense, emotion, operatorSilenceMinutes, prefetch),
    runNovelty(sense, emotion, prefetch),
    runBoundary(sense, prefetch)
  ])

  const boundaryEmotionEvents: EmotionUpdateEvent[] = boundaryResult.newViolations.map((violation) => ({
    trigger: "boundary_violated" as const,
    intensity: violation.severity,
    detail: violation.description
  }))

  return {
    instinct: instinctResult,
    dissonance: dissonanceResult,
    operatorModel: operatorModelResult.operatorModel,
    operatorModelTrigger: operatorModelResult.trigger,
    relationalPatterns: operatorModelResult.updatedPatterns,
    attachmentDynamics: attachmentResult,
    anticipatoryState: anticipationResult,
    noveltyState: noveltyResult,
    boundaryState: boundaryResult.state,
    newBoundaryViolations: boundaryResult.newViolations,
    boundaryEmotionEvents
  }
}

async function runInstinct(sense: SenseResult, emotion: EmotionalState, soma: SomaticState) {
  return computeInstinctImpression(sense.pendingMessages, emotion, soma)
}

async function runDissonance(emotion: EmotionalState, prefetch: FeelPrefetch) {
  const selfKnowledge = prefetch.selfInsights.map((k) => ({ key: k.key, value: k.value }))

  return checkDissonanceWithCooldown({
    recentActions: prefetch.recentActions,
    selfConcept: prefetch.selfConcept,
    emotion,
    selfKnowledge
  })
}

async function runOperatorModel(
  messageTexts: string[],
  messageTimestamps: string[],
  operatorSilenceMinutes: number,
  prefetch: FeelPrefetch
) {
  const operatorModel = await updateOperatorModel({
    messageTexts,
    messageTimestamps,
    silenceMinutes: operatorSilenceMinutes,
    previousModel: prefetch.previousOperatorModel
  })
  const correction = detectModelCorrection(prefetch.previousOperatorModel, operatorModel)
  if (correction) {
    operatorModel.modelConfidence = Math.max(0.1, operatorModel.modelConfidence - 0.1)
    operatorModel.correctionCount++
  }

  const trigger = correction ? "correction" : "update"

  let updatedPatterns = null
  if (messageTexts.length > 0) {
    const signals = extractSignals(messageTexts)
    const learned = learnFromObservation(signals, operatorModel, prefetch.relationalPatterns)
    if (learned !== prefetch.relationalPatterns) {
      updatedPatterns = learned
    }
  }

  return { operatorModel, trigger, updatedPatterns }
}

function runAttachment(
  emotion: EmotionalState,
  operatorSilenceMinutes: number,
  sense: SenseResult,
  prefetch: FeelPrefetch
) {
  const operatorJustReturned = isOperatorReturning(sense.pendingMessages.length, operatorSilenceMinutes)
  const waitingPerception = computeWaitingPerception(operatorSilenceMinutes, prefetch.attachmentStyle.anxious)

  return evaluateAttachmentDynamics(prefetch.attachmentStyle, {
    operatorSilenceMinutes,
    operatorJustReturned,
    inConversation: sense.moodContext.inConversation,
    connectionLevel: emotion.connection,
    frustrationLevel: emotion.frustration,
    cautionLevel: emotion.caution,
    trustExperience: prefetch.trustExperience,
    waitingPerception
  })
}

async function runAnticipation(
  sense: SenseResult,
  emotion: EmotionalState,
  operatorSilenceMinutes: number,
  prefetch: FeelPrefetch
) {
  const operatorJustReturned = isOperatorReturning(sense.pendingMessages.length, operatorSilenceMinutes)

  return updateAnticipatoryState(
    prefetch.previousAnticipation,
    {
      inConversation: sense.moodContext.inConversation,
      operatorSilenceMinutes,
      connectionLevel: emotion.connection,
      hasCalendarEvents: false
    },
    operatorJustReturned,
    operatorSilenceMinutes,
    sense.moodContext.inConversation
  )
}

function runNovelty(sense: SenseResult, emotion: EmotionalState, prefetch: FeelPrefetch) {
  return updateNoveltyState(
    prefetch.previousNovelty,
    sense.pendingMessages.map((m) => m.text),
    emotion,
    true
  )
}

function runBoundary(sense: SenseResult, prefetch: FeelPrefetch) {
  const messageTexts = sense.pendingMessages.map((m) => m.text)
  return updateBoundaryState(prefetch.previousBoundaryState, messageTexts, {
    trustLevel: prefetch.trustExperience,
    attachmentSecurity: prefetch.attachmentStyle.secure,
    vulnerabilityLevel: 0
  })
}
