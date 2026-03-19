import type { EmotionalState, EmotionUpdateEvent } from "@/affect/emotion/types.ts"
import type { SomaticState } from "@/affect/soma/types.ts"
import { computeInstinctImpression } from "@/cognition/instinct.ts"
import { queryImplicitAssociations } from "@/cognition/learning/association/compute.ts"
import { getActiveAssociations } from "@/cognition/learning/association/state.ts"
import { log } from "@/infra/lib/logger.ts"
import { clamp01 } from "@/infra/lib/math.ts"
import { updateAnticipatoryState } from "@/perception/anticipation/compute.ts"
import { DEFAULT_ANTICIPATORY_STATE } from "@/perception/anticipation/types.ts"
import { updateNoveltyState } from "@/perception/novelty/compute.ts"
import { DEFAULT_NOVELTY_STATE } from "@/perception/novelty/types.ts"
import { computeIsolationStress } from "@/relational/attachment/baseline.ts"
import { DEFAULT_ISOLATION_STRESS } from "@/relational/attachment/types.ts"
import {
  computeWaitingPerception,
  evaluateAttachmentDynamics,
  isOperatorReturning
} from "@/relational/attachment/update.ts"
import { computeMentalizingModulation, computeMentalizingState } from "@/relational/mind/mentalizing.ts"
import { extractSignals, learnFromObservation } from "@/relational/mind/triggers.ts"
import { detectModelCorrection, updateOperatorModel } from "@/relational/mind/update.ts"
import { activatePattern, computePatternModulation, matchRelationalPattern } from "@/relational/patterns/compute.ts"
import type { BoundaryUpdateResult } from "@/self/boundaries/compute.ts"
import { updateBoundaryState } from "@/self/boundaries/compute.ts"
import { DEFAULT_BOUNDARY_STATE } from "@/self/boundaries/types.ts"
import { checkDissonanceWithCooldown } from "@/self/dissonance/compute.ts"
import type { SenseResult } from "../../types.ts"
import type { FeelPrefetch, ParallelFanResult } from "./types.ts"

function settledValueOrDefault<T>(result: PromiseSettledResult<T>, fallback: T, label: string): T {
  if (result.status === "fulfilled") return result.value
  log.error(`Parallel subsystem "${label}" failed, using default`, { error: String(result.reason) })
  return fallback
}

export async function runParallelSubsystems(
  emotion: EmotionalState,
  soma: SomaticState,
  sense: SenseResult,
  prefetch: FeelPrefetch
): Promise<ParallelFanResult> {
  const operatorSilenceMinutes = sense.moodContext.operatorSilenceMinutes
  const messageTexts = sense.pendingMessages.map((m) => m.text)
  const messageTimestamps = sense.pendingMessages.map((m) => new Date(m.date * 1000).toISOString())

  const settled = await Promise.allSettled([
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

  const [sInstinct, sDissonance, sOperator, sAttach, sAnticipation, sNovelty, sBoundary, sIsolation, sAssoc] =
    settled as [
      PromiseSettledResult<Awaited<ReturnType<typeof runInstinct>>>,
      PromiseSettledResult<Awaited<ReturnType<typeof runDissonance>>>,
      PromiseSettledResult<Awaited<ReturnType<typeof runOperatorModel>>>,
      PromiseSettledResult<Awaited<ReturnType<typeof runAttachment>>>,
      PromiseSettledResult<Awaited<ReturnType<typeof runAnticipation>>>,
      PromiseSettledResult<Awaited<ReturnType<typeof runNovelty>>>,
      PromiseSettledResult<Awaited<ReturnType<typeof runBoundary>>>,
      PromiseSettledResult<Awaited<ReturnType<typeof runIsolationCost>>>,
      PromiseSettledResult<Awaited<ReturnType<typeof runImplicitAssociations>>>
    ]

  const instinctResult = settledValueOrDefault(
    sInstinct,
    { impulse: "neutral" as const, confidence: 0, basis: "", episodicMatches: 0, emotionalCharge: 0 },
    "instinct"
  )
  const dissonanceResult = settledValueOrDefault(
    sDissonance,
    { activeDissonance: 0, recentEvents: [], cumulativeUnresolved: 0 },
    "dissonance"
  )
  const operatorModelResult = settledValueOrDefault(
    sOperator,
    { operatorModel: prefetch.previousOperatorModel, trigger: "none" as const, updatedPatterns: null },
    "operatorModel"
  )
  const attachmentResult = settledValueOrDefault(
    sAttach,
    { separationDistress: 0, reunionResponse: 0, safeHavenSeeking: 0, explorationBalance: 0.5 },
    "attachment"
  )
  const anticipationResult = settledValueOrDefault(sAnticipation, DEFAULT_ANTICIPATORY_STATE, "anticipation")
  const noveltyResult = settledValueOrDefault(sNovelty, DEFAULT_NOVELTY_STATE, "novelty")
  const boundaryResult = settledValueOrDefault(
    sBoundary,
    { state: DEFAULT_BOUNDARY_STATE, newViolations: [] } as BoundaryUpdateResult,
    "boundary"
  )
  const isolationStressResult = settledValueOrDefault(sIsolation, DEFAULT_ISOLATION_STRESS, "isolationStress")
  const activeAssociations = settledValueOrDefault(
    sAssoc,
    [] as Awaited<ReturnType<typeof runImplicitAssociations>>,
    "implicitAssociations"
  )

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

  const mentalizingModulation = computeMentalizingModulation(mentalizingState)
  const mentalizingOperatorModel = {
    ...operatorModelResult.operatorModel,
    modelConfidence: clamp01(
      operatorModelResult.operatorModel.modelConfidence + mentalizingModulation.confidenceModifier
    )
  }

  return {
    instinct: instinctResult,
    dissonance: dissonanceResult,
    operatorModel: mentalizingOperatorModel,
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
