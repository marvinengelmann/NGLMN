import type { EmotionalState, EmotionUpdateEvent } from "@/affect/emotion/types.ts"
import type { SomaticState } from "@/affect/soma/types.ts"
import { computeInstinctImpression } from "@/cognition/instinct.ts"
import { queryImplicitAssociations } from "@/cognition/learning/association/compute.ts"
import { getActiveAssociations } from "@/cognition/learning/association/state.ts"
import { updateAnticipatoryState } from "@/perception/anticipation/compute.ts"
import { updateNoveltyState } from "@/perception/novelty/compute.ts"
import { computeIsolationStress } from "@/relational/attachment/baseline.ts"
import {
  computeWaitingPerception,
  evaluateAttachmentDynamics,
  isOperatorReturning
} from "@/relational/attachment/update.ts"
import { extractSignals, learnFromObservation } from "@/relational/mind/triggers.ts"
import { computeMentalizingState } from "@/relational/mind/mentalizing.ts"
import { detectModelCorrection, updateOperatorModel } from "@/relational/mind/update.ts"
import { activatePattern, computePatternModulation, matchRelationalPattern } from "@/relational/patterns/compute.ts"
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
    boundaryResult,
    isolationStressResult,
    activeAssociations
  ] = await Promise.all([
    runInstinct(sense, emotion, soma),
    runDissonance(emotion, prefetch),
    runOperatorModel(messageTexts, messageTimestamps, operatorSilenceMinutes, prefetch),
    runAttachment(emotion, operatorSilenceMinutes, sense, prefetch),
    runAnticipation(sense, emotion, operatorSilenceMinutes, prefetch),
    runNovelty(sense, emotion, prefetch),
    runBoundary(sense, prefetch),
    runIsolationCost(sense, prefetch),
    runImplicitAssociations(sense)
  ])

  const boundaryEmotionEvents: EmotionUpdateEvent[] = boundaryResult.newViolations.map((violation) => ({
    trigger: "boundary_violated" as const,
    intensity: violation.severity,
    detail: violation.description
  }))

  const patternMatch = matchRelationalPattern(prefetch.previousRelationalPatternState.templates, {
    operatorMood: operatorModelResult.operatorModel.estimatedMood ?? "neutral",
    messageText: messageTexts.join(" "),
    interactionTone: operatorModelResult.trigger,
    recentPatterns: (operatorModelResult.updatedPatterns ?? prefetch.relationalPatterns)?.patterns ?? [],
    timeOfDay: new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"
  })

  const patternActivationEvent = patternMatch
    ? activatePattern(
        patternMatch.template,
        patternMatch.confidence,
        prefetch.previousRelationalPatternState.awarenessLevel
      )
    : null
  const patternModulation = computePatternModulation(patternActivationEvent)

  const mentalizingState = computeMentalizingState(prefetch.previousMentalizingState, {
    cortisolLevel: prefetch.previousNeuromodulatoryState.cortisol.level,
    attachmentSecure: prefetch.attachmentStyle.secure,
    attachmentAnxious: prefetch.attachmentStyle.anxious,
    cognitiveFatigue: prefetch.previousMetacognition.cognitiveFatigue,
    isolationCost: isolationStressResult.isolationCost,
    vulnerabilityOpen: false,
    regulationZone: prefetch.previousAutonomicState.zone,
    metacognitiveClarity: prefetch.previousMetacognition.cognitiveClarity,
    predictionAccuracy: operatorModelResult.operatorModel.predictionAccuracy.runningAverage
  })

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
    boundaryEmotionEvents,
    isolationStress: isolationStressResult,
    implicitAssociations: activeAssociations,
    patternModulation,
    patternActivationEvent,
    mentalizingState
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

async function runImplicitAssociations(sense: SenseResult) {
  const associations = await getActiveAssociations()
  const currentStimuli = sense.pendingMessages.map((m) => `message:${m.text.slice(0, 30)}`)
  return queryImplicitAssociations(currentStimuli, associations)
}

function runIsolationCost(sense: SenseResult, prefetch: FeelPrefetch) {
  return computeIsolationStress({
    operatorSilenceMinutes: sense.moodContext.operatorSilenceMinutes,
    inConversation: sense.moodContext.inConversation,
    attachmentStyle: prefetch.attachmentStyle,
    cortisol: prefetch.previousNeuromodulatoryState.cortisol.level,
    previousAllostasis: prefetch.previousIsolationStress.allostasis
  })
}

function runBoundary(sense: SenseResult, prefetch: FeelPrefetch) {
  const messageTexts = sense.pendingMessages.map((m) => m.text)
  return updateBoundaryState(prefetch.previousBoundaryState, messageTexts, {
    trustLevel: prefetch.trustExperience,
    attachmentSecurity: prefetch.attachmentStyle.secure,
    vulnerabilityLevel: 0
  })
}
