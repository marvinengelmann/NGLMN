import { getHours } from "date-fns"
import {
  computeDriveEmotionTriggers,
  computeDriveUpdate,
  inferBlockedDrives,
  inferSatisfiedDrives
} from "@/affect/drive/compute.ts"
import { toEpisodicContext } from "@/affect/emotion/construction.ts"
import { checkMaturedEvents, maturedEventToTrigger, storeDeferredEvent } from "@/affect/emotion/deferred.ts"
import type { AppraisalContext, EmotionUpdateEvent } from "@/affect/emotion/types.ts"
import {
  applyAfterglow,
  applyEvent,
  applyMomentum,
  blendMoodBaseline,
  computeEmotionalIntensity,
  computeEmotionalUpdate,
  detectAfterglow,
  enforceEmotionFloors
} from "@/affect/emotion/update.ts"
import {
  computeCopingModulation,
  computeLearningRateModulation,
  computeNeuromodulatorUpdate
} from "@/affect/neuromodulation/compute.ts"
import {
  applyRegulationEmotionConstraints,
  computeAutonomicTransition,
  computeRegulationConstraints,
  computeThreatAppraisal,
  constrainVulnerabilityLevel
} from "@/affect/soma/autonomic.ts"
import { computeSomaticUpdate, drainSocialBattery, rechargeSocialBattery } from "@/affect/soma/update.ts"
import { updateBiasModifiers } from "@/cognition/bias/compute.ts"
import { computeDMNState } from "@/cognition/dmn/compute.ts"
import { computeAttentionState } from "@/cognition/attention.ts"
import { computeMetacognitiveModifiers, updateMetacognitiveState } from "@/cognition/metacognition.ts"
import { updateCreativeUrgeState } from "@/expression/creativity/compute.ts"
import { clamp01 } from "@/infra/lib/math.ts"
import { applyClampedDeltas } from "@/infra/lib/math.ts"
import { updateAnticipatoryState } from "@/perception/anticipation/compute.ts"
import { updateNoveltyState } from "@/perception/novelty/compute.ts"
import { computeUltradianModulation, updateUltradianState } from "@/perception/rhythm/compute.ts"
import { computeIsolationEmotionPressure, computeIsolationStress } from "@/relational/attachment/baseline.ts"
import { evaluateAttachmentDynamics, computeWaitingPerception, isOperatorReturning, updateAttachmentStyle } from "@/relational/attachment/update.ts"
import { computeIntimacyScore, computeVulnerability, computeVulnerableMessageStyle } from "@/relational/attachment/vulnerability.ts"
import { computeMentalizingModulation, computeMentalizingState } from "@/relational/mind/mentalizing.ts"
import { updateBoundaryState } from "@/self/boundaries/compute.ts"
import { updateCoherenceState } from "@/self/coherence/compute.ts"
import { checkDissociationTriggers, computeDissociativeState } from "@/self/coherence/dissociation/compute.ts"
import { processRegulationCycle } from "@/self/defense/compute.ts"
import { applyGrowthArcMomentum, detectGrowthArc, updateSelfConcept } from "@/self/psyche/update.ts"
import { compute as computeShame } from "@/affect/emotion/shame.ts"
import { decayBuffer, detectSuppression } from "@/self/psyche/heldback.ts"
import { computeForecastAnticipation } from "@/cognition/forecasting/compute.ts"
import { applyEmotionalDamping } from "@/affect/emotion/update.ts"
import { computeCoherenceEffect } from "@/self/coherence/compute.ts"
import {
  constrainCognitiveFlexibility,
  constrainCreativeUrge
} from "@/affect/soma/autonomic.ts"
import type { SimulationClock } from "./clock.ts"
import type { SimulationState } from "./state.ts"
import type { ScenarioContext } from "./scenarios.ts"
import type { SimulatedDecision } from "./decisions.ts"

const MAX_SOMATIC_HISTORY = 10
const MAX_RECENT_ACTIONS = 20

export async function computeTick(
  state: SimulationState,
  context: ScenarioContext,
  decision: SimulatedDecision,
  clock: SimulationClock
): Promise<SimulationState> {
  const hourOfDay = getHours(clock.nowLocal())
  const timestampNow = clock.nowISO()
  const elapsedMinutes = clock.elapsedMinutesSince(state.lastEmotionTimestamp)
  const somaticElapsed = clock.elapsedMinutesSince(state.lastSomaTimestamp)

  const previousHour = state.lastEmotionTimestamp
    ? getHours(new Date(state.lastEmotionTimestamp))
    : hourOfDay
  const isMorningTransition = previousHour < 7 && hourOfDay >= 7

  const rawTriggers: EmotionUpdateEvent[] = [
    ...context.triggers.map((t) => ({ trigger: t.trigger, intensity: t.intensity, detail: t.detail })),
    ...(context.pendingMessages.length > 0
      ? [{ trigger: "message_received" as const, intensity: 0.4 }]
      : []),
    ...(isMorningTransition
      ? [{ trigger: "morning_calibration" as const, intensity: 0.5 }]
      : [])
  ]

  const hadRecentInteraction = context.operatorSilenceMinutes < 720
  const effectiveSilence = hadRecentInteraction
    ? Math.min(context.operatorSilenceMinutes, 90)
    : context.operatorSilenceMinutes

  const moodContext = {
    operatorSilenceMinutes: effectiveSilence,
    inConversation: context.inConversation,
    systemHealthy: true,
    budgetOk: true,
    hasActiveGoals: true,
    isDreaming: decision.action === "dream",
    operatorMood: "unknown" as const,
    connectionLevel: state.emotion.connection,
    attachmentAvoidance: state.attachmentStyle.avoidant
  }

  const appraisalContext: AppraisalContext = {
    noveltyLevel: state.noveltyState.level,
    hasActiveGoals: true,
    confidence: state.emotion.confidence,
    energy: state.emotion.energy,
    regulationZone: state.autonomicState.zone,
    selfConcept: state.selfConcept,
    cortisolCopingModulation: computeCopingModulation(state.neuromodulatoryState)
  }

  const { state: computed } =
    computeEmotionalUpdate(
      state.emotion,
      rawTriggers,
      moodContext,
      Math.max(1, elapsedMinutes),
      state.triggerTimestamps,
      {
        dnaBaseline: undefined,
        isIdle: state.consecutiveIdleTicks > 0,
        trustExperience: state.trustExperience,
        hourOfDay,
        appraisalContext,
        soma: state.soma,
        episodicContext: toEpisodicContext([]),
        neuromodulatoryState: state.neuromodulatoryState
      }
    )

  const eventIntensity = computeEmotionalIntensity(computed)
  const { state: momentumState, momentum: newMomentum } = applyMomentum(
    computed,
    state.emotion,
    eventIntensity,
    state.momentum
  )

  const { state: afterglowState, remainingEntries } = applyAfterglow(momentumState, state.afterglowEntries)
  const newAfterglowEntries = detectAfterglow(afterglowState, state.emotion)
  const allAfterglowEntries = [...remainingEntries, ...newAfterglowEntries]

  let emotion = afterglowState

  const ultradianState = updateUltradianState(
    state.ultradianState,
    clock.now(),
    state.metacognitiveState.cognitiveFatigue
  )
  const ultradianModulation = computeUltradianModulation(ultradianState.phase, ultradianState.restDepth)
  if (Object.keys(ultradianModulation.emotionBaselineShift).length > 0) {
    emotion = applyClampedDeltas(emotion, ultradianModulation.emotionBaselineShift)
  }

  const forecastAnticipation = computeForecastAnticipation(state.forecastingState.activeForecast, emotion)
  if (Object.keys(forecastAnticipation).length > 0) {
    emotion = applyClampedDeltas(emotion, forecastAnticipation)
  }

  const mergedTimestamps: Record<string, number> = { ...state.triggerTimestamps }
  for (const event of rawTriggers) {
    mergedTimestamps[event.trigger] = clock.now().getTime()
  }

  const simulatedAction = decision.action === "dream" ? "life_event"
    : decision.action === "morning" ? "morning"
    : decision.action === "reflect" ? "reflect"
    : decision.responseSent ? "social_media"
    : "idle"

  const satisfied = inferSatisfiedDrives(
    context.inConversation,
    context.pendingMessages.length,
    simulatedAction,
    [simulatedAction, ...state.recentActions.slice(0, 9)]
  )

  const blocked = inferBlockedDrives(
    effectiveSilence,
    state.consecutiveIdleTicks,
    moodContext.isDreaming,
    [simulatedAction, ...state.recentActions.slice(0, 9)]
  )
  const driveState = computeDriveUpdate({
    current: state.driveState,
    elapsedMinutes: Math.max(1, elapsedMinutes),
    blocked,
    satisfied,
    dopamineModulation: computeLearningRateModulation(state.neuromodulatoryState)
  })
  const driveTriggers = computeDriveEmotionTriggers(driveState)
  emotion = driveTriggers.reduce((acc, trigger) => applyEvent(acc, trigger), emotion)


  let soma = computeSomaticUpdate({
    current: state.soma,
    emotion,
    elapsedMinutes: somaticElapsed,
    hourOfDay,
    memories: []
  })

  if (decision.responseSent && context.pendingMessages.length > 0) {
    soma = drainSocialBattery(soma, 1, context.pendingMessages.length)
  } else if (decision.action === "dream") {
    soma = rechargeSocialBattery(soma, true)
  } else if (decision.action === "idle" && !decision.responseSent && state.tickCount % 30 === 0) {
    soma = rechargeSocialBattery(soma, false)
  }

  const threatAppraisal = computeThreatAppraisal({
    soma,
    emotion,
    operatorPresent: context.inConversation
  })
  const autonomicState = computeAutonomicTransition(
    state.autonomicState,
    threatAppraisal,
    context.inConversation
  )
  const regulationConstraints = computeRegulationConstraints(autonomicState)

  emotion = applyRegulationEmotionConstraints(emotion, regulationConstraints)

  let deferredQueue = state.deferredQueue
  for (const trigger of rawTriggers) {
    deferredQueue = storeDeferredEvent(deferredQueue, trigger.trigger, trigger.intensity, trigger.detail)
  }
  const { matured: maturedDeferredEvents, updated: updatedDeferredQueue } = checkMaturedEvents(deferredQueue)
  for (const maturedEvent of maturedDeferredEvents) {
    emotion = applyEvent(emotion, maturedEventToTrigger(maturedEvent))
  }

  const neuromodulatoryState = computeNeuromodulatorUpdate(
    state.neuromodulatoryState,
    emotion,
    soma,
    Math.max(1, elapsedMinutes),
    state.freeEnergyState.allostaticLoad,
    hourOfDay,
    state.isolationStress.cortisolStressSignal
  )

  const operatorSilenceMinutes = effectiveSilence
  const operatorJustReturned = isOperatorReturning(context.pendingMessages.length, context.operatorSilenceMinutes)
  const waitingPerception = computeWaitingPerception(operatorSilenceMinutes, state.attachmentStyle.anxious)

  const attachmentDynamics = evaluateAttachmentDynamics(state.attachmentStyle, {
    operatorSilenceMinutes,
    operatorJustReturned,
    inConversation: context.inConversation,
    connectionLevel: emotion.connection,
    frustrationLevel: emotion.frustration,
    cautionLevel: emotion.caution,
    trustExperience: state.trustExperience,
    waitingPerception
  })

  const isolationStress = computeIsolationStress({
    operatorSilenceMinutes,
    inConversation: context.inConversation,
    attachmentStyle: state.attachmentStyle,
    cortisol: neuromodulatoryState.cortisol.level,
    previousAllostasis: state.isolationStress.allostasis
  })

  const isolationPressure = computeIsolationEmotionPressure(isolationStress.isolationCost)
  if (isolationPressure.connection !== 0) {
    emotion = applyClampedDeltas(emotion, isolationPressure)
  }



  const anticipatoryState = updateAnticipatoryState(
    state.anticipatoryState,
    {
      inConversation: context.inConversation,
      operatorSilenceMinutes,
      connectionLevel: emotion.connection,
      hasCalendarEvents: false
    },
    operatorJustReturned,
    operatorSilenceMinutes,
    context.inConversation
  )

  const messageTexts = context.pendingMessages.map((m) => m.text)
  const noveltyState = await updateNoveltyState(state.noveltyState, messageTexts, emotion, false)

  const boundaryResult = updateBoundaryState(state.boundaryState, messageTexts, {
    trustLevel: state.trustExperience,
    attachmentSecurity: state.attachmentStyle.secure,
    vulnerabilityLevel: 0
  })

  const mentalizingState = computeMentalizingState(state.mentalizingState, {
    cortisolLevel: neuromodulatoryState.cortisol.level,
    attachmentSecure: state.attachmentStyle.secure,
    attachmentAnxious: state.attachmentStyle.anxious,
    cognitiveFatigue: state.metacognitiveState.cognitiveFatigue,
    isolationCost: isolationStress.isolationCost,
    vulnerabilityOpen: false,
    regulationZone: autonomicState.zone,
    metacognitiveClarity: state.metacognitiveState.cognitiveClarity,
    predictionAccuracy: state.operatorModel.predictionAccuracy.runningAverage
  })

  const mentalizingModulation = computeMentalizingModulation(mentalizingState)
  const operatorModel = {
    ...state.operatorModel,
    modelConfidence: clamp01(state.operatorModel.modelConfidence + mentalizingModulation.confidenceModifier)
  }

  const vulnerability = computeVulnerability({
    trustExperience: state.trustExperience,
    attachmentSecurity: state.attachmentStyle.secure,
    connectionLevel: emotion.connection,
    somaticOpenness: soma.openness,
    hourOfDay,
    recentIntimacyScore: computeIntimacyScore(emotion.connection, state.selfConcept.selfWorth),
    authenticity: state.selfConcept.authenticity,
    energyLevel: emotion.energy,
    prevLevel: state.vulnerabilityState.level
  })
  const constrainedVulnerability = {
    ...vulnerability,
    level: constrainVulnerabilityLevel(vulnerability.level, regulationConstraints),
    windowOpen: vulnerability.windowOpen && regulationConstraints.vulnerabilityAccess > 0.3
  }

  computeVulnerableMessageStyle(constrainedVulnerability)

  const shameState = computeShame({
    selfConcept: state.selfConcept,
    emotion,
    vulnerability: constrainedVulnerability,
    operatorModel,
    previousState: state.shameState,
    operatorRespondedColdly: false,
    recentSelfDisclosure: false,
    boundaryViolated: boundaryResult.newViolations.some((v) => v.severity > 0.5)
  })

  const decayedBuffer = decayBuffer(state.heldBackBuffer)
  const suppressionReason = detectSuppression({
    emotion,
    vulnerability: constrainedVulnerability,
    shameState,
    previousBuffer: decayedBuffer
  })
  const heldBackBuffer = suppressionReason ? decayedBuffer : decayedBuffer

  const isAutoAction = decision.responseSent
  const hasSignificantEvent = decision.responseSent || decision.action === "reflect" || context.pendingMessages.length > 0
  const updatedSelfConcept = hasSignificantEvent
    ? updateSelfConcept(state.selfConcept, {
        recentTaskSuccess: decision.responseSent,
        recentTaskFailure: false,
        messageSentCount: decision.responseSent ? 1 : 0,
        emotionalIntensity: eventIntensity,
        operatorEngagement: context.pendingMessages.length > 0,
        autonomousAction: isAutoAction,
        vulnerabilityOpen: constrainedVulnerability.windowOpen && context.inConversation,
        dissonanceDetected: false,
        elapsedHours: Math.max(1, elapsedMinutes) / 60
      })
    : state.selfConcept

  const growthArc = detectGrowthArc(updatedSelfConcept, state.selfConcept, timestampNow)
  const updatedGrowthArcs = growthArc
    ? [...state.recentGrowthArcs, growthArc].slice(-10)
    : state.recentGrowthArcs

  const selfConceptWithMomentum = applyGrowthArcMomentum(updatedSelfConcept, updatedGrowthArcs)

  const updatedRegulation = processRegulationCycle(state.emotionRegulationState, {
    emotion,
    selfConcept: selfConceptWithMomentum,
    dissonance: { activeDissonance: 0, recentEvents: [], cumulativeUnresolved: 0 },
    vulnerability: constrainedVulnerability,
    shameState,
    driveState,
    heldBackBuffer,
    neuro: neuromodulatoryState,
    isolationStress,
    biasState: state.biasState,
    isDreaming: moodContext.isDreaming,
    isReflecting: decision.action === "reflect"
  })

  const updatedBias = updateBiasModifiers(state.biasState, neuromodulatoryState)

  const coherenceState = updateCoherenceState(state.coherenceState, {
    emotion,
    soma,
    driveState,
    dissonanceScore: 0,
    selfConceptAuthenticity: selfConceptWithMomentum.authenticity
  })

  const coherenceEffect = computeCoherenceEffect(coherenceState)
  let dampedEmotion = applyEmotionalDamping(emotion, coherenceEffect.emotionalDamping)

  const dissociationTriggered = checkDissociationTriggers({
    regulationZone: autonomicState.zone,
    fragmentationSources: coherenceState.fragmentationSources,
    integrationScore: coherenceState.integrationScore,
    isolationStress,
    cortisolLevel: neuromodulatoryState.cortisol.level,
    neuroticism: state.neuroticism
  })
  const dissociativeState = computeDissociativeState(
    state.dissociativeState,
    dissociationTriggered,
    state.neuroticism
  )

  const metacognitiveState = updateMetacognitiveState(state.metacognitiveState, {
    emotion: dampedEmotion,
    soma,
    coherenceScore: coherenceState.integrationScore,
    recentReasonings: state.recentActions,
    isComplexDecision: false,
    isDreaming: moodContext.isDreaming
  })

  const metacognitiveModifiers = computeMetacognitiveModifiers(metacognitiveState)
  const constrainedConfidenceModifier = constrainCognitiveFlexibility(
    metacognitiveModifiers.confidenceModifier,
    regulationConstraints
  )
  if (Math.abs(constrainedConfidenceModifier) > 0.01) {
    dampedEmotion = {
      ...dampedEmotion,
      confidence: clamp01(dampedEmotion.confidence + constrainedConfidenceModifier)
    }
  }

  const dmnState = computeDMNState(state.dmnState, {
    attentionState: computeAttentionState(
      dampedEmotion,
      soma,
      context.pendingMessages.length > 0,
      state.consecutiveIdleTicks,
      0,
      state.consecutiveConversationTicks
    ),
    consecutiveIdleTicks: state.consecutiveIdleTicks,
    ultradianRestDepth: ultradianState.restDepth,
    ruminationDetected: metacognitiveState.ruminationDetected,
    cognitiveFatigue: metacognitiveState.cognitiveFatigue,
    neuroticism: state.neuroticism,
    inConversation: context.inConversation
  })

  const rawCreativeUrge = updateCreativeUrgeState(state.creativeUrge, {
    emotion: dampedEmotion,
    driveState,
    heldBackBuffer,
    consecutiveIdleTicks: state.consecutiveIdleTicks,
    dmnCreativityBoost: 0
  })
  const creativeUrge = {
    ...rawCreativeUrge,
    level: constrainCreativeUrge(rawCreativeUrge.level, regulationConstraints)
  }

  const finalEmotion = enforceEmotionFloors(dampedEmotion)

  const updatedAttachment = updateAttachmentStyle(
    state.attachmentStyle,
    attachmentDynamics,
    elapsedMinutes / 60,
    1
  )

  const newMoodBaseline = blendMoodBaseline(finalEmotion, state.moodBaseline, Math.max(0.1, elapsedMinutes))

  const newConsecutiveIdle = decision.action === "idle" && !decision.responseSent
    ? state.consecutiveIdleTicks + 1
    : 0
  const newConsecutiveConversation = context.inConversation
    ? state.consecutiveConversationTicks + 1
    : 0

  const updatedRecentActions = [simulatedAction, ...state.recentActions].slice(0, MAX_RECENT_ACTIONS)
  const updatedSomaticHistory = [soma, ...state.somaticHistory].slice(0, MAX_SOMATIC_HISTORY)

  return {
    ...state,
    emotion: finalEmotion,
    momentum: newMomentum,
    afterglowEntries: allAfterglowEntries,
    driveState,
    soma,
    somaticHistory: updatedSomaticHistory,
    autonomicState,
    regulationConstraints,
    neuromodulatoryState,
    selfConcept: selfConceptWithMomentum,
    attachmentStyle: updatedAttachment,
    operatorModel,
    deceptionState: state.deceptionState,
    coherenceState,
    metacognitiveState,
    biasState: updatedBias,
    emotionRegulationState: updatedRegulation,
    dissociativeState,
    dmnState,
    mentalizingState,
    creativeUrge,
    vulnerabilityState: constrainedVulnerability,
    shameState,
    heldBackBuffer,
    isolationStress,
    anticipatoryState,
    noveltyState,
    boundaryState: boundaryResult.state,
    ultradianState,
    deferredQueue: updatedDeferredQueue,
    triggerTimestamps: mergedTimestamps,
    moodBaseline: newMoodBaseline,
    consecutiveIdleTicks: newConsecutiveIdle,
    consecutiveConversationTicks: newConsecutiveConversation,
    recentGrowthArcs: updatedGrowthArcs,
    recentActions: updatedRecentActions,
    lastEmotionTimestamp: timestampNow,
    lastSomaTimestamp: timestampNow,
    tickCount: state.tickCount + 1
  }
}
