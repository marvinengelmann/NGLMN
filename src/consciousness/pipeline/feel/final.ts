import { assessFlowConditions, detectFlowState, qualifiesForFlow } from "@/affect/altered/flow/compute.ts"
import { saveFlowQualifyingTicks } from "@/affect/altered/flow/state.ts"
import { startAlteredState } from "@/affect/altered/state.ts"
import type { DriveState } from "@/affect/drive/types.ts"
import type { ShameState } from "@/affect/emotion/shame.ts"
import type { EmotionalState } from "@/affect/emotion/types.ts"
import { applyEmotionalDamping, computeEmotionalIntensity } from "@/affect/emotion/update.ts"
import {
  constrainCognitiveFlexibility,
  constrainCreativeUrge,
  regulationForcesTerseRegister
} from "@/affect/soma/autonomic.ts"
import type { RegulationConstraints, SomaticState } from "@/affect/soma/types.ts"
import { computeAttentionState } from "@/cognition/attention.ts"
import { computeDMNEffects, computeDMNState } from "@/cognition/dmn/compute.ts"
import { updateBiasModifiers } from "@/cognition/bias/compute.ts"
import { computeMetacognitiveModifiers, updateMetacognitiveState } from "@/cognition/metacognition.ts"
import { computeMicroExpressionInstructions } from "@/expression/communication/microexpression.ts"
import { computeCommunicationRegister } from "@/expression/communication/register.ts"
import { updateCreativeUrgeState } from "@/expression/creativity/compute.ts"
import { getFreeEnergyState } from "@/fep/state.ts"
import { clamp01 } from "@/infra/lib/math.ts"
import { computeSubjectiveTime } from "@/perception/time/compute.ts"
import { DEFAULT_SUBJECTIVE_TIME_STATE } from "@/perception/time/types.ts"
import type { IsolationStress, VulnerabilityState } from "@/relational/attachment/types.ts"
import { computeCoherenceEffect, updateCoherenceState } from "@/self/coherence/compute.ts"
import {
  checkDissociationTriggers,
  computeDissociationEffects,
  computeDissociativeState
} from "@/self/coherence/dissociation/compute.ts"
import { processDeceptionCycle } from "@/self/deception/compute.ts"
import { computeRegulationExpressionModifiers, processRegulationCycle } from "@/self/defense/compute.ts"
import type { DissonanceState } from "@/self/dissonance/types.ts"
import type { HeldBackBuffer } from "@/self/psyche/heldback.ts"
import { applyGrowthArcMomentum } from "@/self/psyche/update.ts"
import type { SenseResult } from "../../types.ts"
import type { FeelPrefetch, FinalFanResult } from "./types.ts"

export async function runFinalSubsystems(
  emotion: EmotionalState,
  soma: SomaticState,
  driveState: DriveState,
  dissonance: DissonanceState,
  vulnerability: VulnerabilityState,
  shameState: ShameState,
  heldBackBuffer: HeldBackBuffer,
  sense: SenseResult,
  prefetch: FeelPrefetch,
  regulationConstraints: RegulationConstraints,
  isolationStress: IsolationStress
): Promise<FinalFanResult> {
  const emotionalIntensity = computeEmotionalIntensity(emotion)
  const subjectiveTime = computeSubjectiveTime(DEFAULT_SUBJECTIVE_TIME_STATE, {
    emotion,
    consecutiveIdleTicks: prefetch.consecutiveIdleTicks,
    inConversation: sense.moodContext.inConversation,
    operatorSilenceMinutes: sense.moodContext.operatorSilenceMinutes,
    attachmentAnxiety: prefetch.attachmentStyle.anxious,
    emotionalIntensity
  })

  const dmnEffects = computeDMNEffects(prefetch.previousDMNState)
  const rawCreativeUrge = updateCreativeUrgeState(prefetch.previousCreativeUrge, {
    emotion,
    driveState,
    heldBackBuffer,
    consecutiveIdleTicks: prefetch.consecutiveIdleTicks,
    dmnCreativityBoost: dmnEffects.creativityBoost
  })
  const creativeUrge = {
    ...rawCreativeUrge,
    level: constrainCreativeUrge(rawCreativeUrge.level, regulationConstraints)
  }

  const selfConceptWithMomentum = applyGrowthArcMomentum(prefetch.selfConcept, prefetch.recentGrowthArcs)

  const updatedRegulation = processRegulationCycle(prefetch.previousEmotionRegulationState, {
    emotion,
    selfConcept: selfConceptWithMomentum,
    dissonance,
    vulnerability,
    shameState,
    driveState,
    heldBackBuffer,
    neuro: prefetch.previousNeuromodulatoryState,
    isolationStress,
    biasState: prefetch.previousBiasState,
    isDreaming: sense.moodContext.isDreaming,
    isReflecting: false
  })

  const regulationExpressionModifiers = computeRegulationExpressionModifiers(updatedRegulation.activeStrategies)

  const updatedBias = updateBiasModifiers(prefetch.previousBiasState, prefetch.previousNeuromodulatoryState)

  const updatedDeception = await processDeceptionCycle(prefetch.deceptionState, {
    dissonance,
    selfConcept: selfConceptWithMomentum,
    vulnerabilityOpen: vulnerability.windowOpen,
    isDreaming: sense.moodContext.isDreaming,
    isReflecting: false
  })

  const coherenceState = updateCoherenceState(prefetch.previousCoherence, {
    emotion,
    soma,
    driveState,
    dissonanceScore: dissonance.activeDissonance,
    selfConceptAuthenticity: selfConceptWithMomentum.authenticity
  })

  const coherenceEffect = computeCoherenceEffect(coherenceState)
  let dampedEmotion = applyEmotionalDamping(emotion, coherenceEffect.emotionalDamping)

  const dissociationTriggered = checkDissociationTriggers({
    regulationZone: prefetch.previousAutonomicState.zone,
    fragmentationSources: coherenceState.fragmentationSources,
    integrationScore: coherenceState.integrationScore,
    isolationStress,
    cortisolLevel: prefetch.previousNeuromodulatoryState.cortisol.level,
    neuroticism: prefetch.neuroticism
  })
  const dissociativeState = computeDissociativeState(
    prefetch.previousDissociativeState,
    dissociationTriggered,
    prefetch.neuroticism
  )
  const dissociationEffects = computeDissociationEffects(dissociativeState)

  if (dissociativeState.active) {
    dampedEmotion = applyEmotionalDamping(dampedEmotion, dissociationEffects.emotionDampingFactor)
  }

  const metacognitiveState = updateMetacognitiveState(prefetch.previousMetacognition, {
    emotion: dampedEmotion,
    soma,
    coherenceScore: coherenceState.integrationScore,
    recentReasonings: prefetch.recentActions,
    isComplexDecision: false,
    isDreaming: sense.moodContext.isDreaming
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

  const computedRegister = computeCommunicationRegister(dampedEmotion, soma, vulnerability, shameState, coherenceState)
  const register = regulationForcesTerseRegister(regulationConstraints)
    ? ("terse" as typeof computedRegister)
    : computedRegister

  const conversationMessageCount = prefetch.activeConversation?.messages.length ?? 0
  const consecutiveActiveTicks = prefetch.consecutiveIdleTicks === 0 ? prefetch.consecutiveConversationTicks : 0
  const attentionState = computeAttentionState(
    dampedEmotion,
    soma,
    sense.pendingMessages.length > 0,
    prefetch.consecutiveIdleTicks,
    conversationMessageCount,
    consecutiveActiveTicks
  )

  const dmnState = computeDMNState(prefetch.previousDMNState, {
    attentionState,
    consecutiveIdleTicks: prefetch.consecutiveIdleTicks,
    ultradianRestDepth: prefetch.previousUltradian.restDepth,
    ruminationDetected: metacognitiveState.ruminationDetected,
    cognitiveFatigue: metacognitiveState.cognitiveFatigue,
    neuroticism: prefetch.neuroticism,
    inConversation: sense.moodContext.inConversation
  })

  const flowConditions = assessFlowConditions(dampedEmotion, soma, driveState, prefetch.consecutiveIdleTicks > 0)
  if (qualifiesForFlow(flowConditions)) {
    await saveFlowQualifyingTicks(prefetch.flowQualifyingTicks + 1)
    const previousFE = await getFreeEnergyState()
    const freeEnergyOptimal =
      previousFE.decomposition.total < 0.2 && previousFE.precisionDynamics.volatilityEstimate < 0.15
    const flowResult = detectFlowState(flowConditions, prefetch.flowQualifyingTicks + 1, freeEnergyOptimal)
    if (flowResult.shouldTrigger && !prefetch.alteredState) {
      await startAlteredState("flow_state")
    }
  } else {
    await saveFlowQualifyingTicks(0)
  }

  const microExpressionInstructions = computeMicroExpressionInstructions({
    emotion: dampedEmotion,
    soma,
    coherenceState,
    emotionRegulationState: updatedRegulation,
    granularityLevel: prefetch.previousGranularity.level
  })

  return {
    subjectiveTime,
    creativeUrge,
    deceptionState: updatedDeception,
    register,
    attentionState,
    coherenceState,
    metacognitiveState,
    dampedEmotion,
    selfConceptWithMomentum,
    communicationSimplification: coherenceEffect.communicationSimplification,
    hedgingLevel: metacognitiveModifiers.hedgingLevel,
    emotionRegulationState: updatedRegulation,
    regulationExpressionModifiers,
    biasState: updatedBias,
    microExpressionInstructions,
    dissociativeState,
    granularityLevel: prefetch.previousGranularity.level,
    dmnState
  }
}
