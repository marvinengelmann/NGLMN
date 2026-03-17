import type { DriveState } from "@/affect/drive/types.ts"
import type { ShameState } from "@/affect/emotion/shame.ts"
import type { EmotionalState } from "@/affect/emotion/types.ts"
import { applyEmotionalDamping, computeEmotionalIntensity } from "@/affect/emotion/update.ts"
import type { SomaticState, VagalConstraints } from "@/affect/soma/types.ts"
import { constrainCognitiveFlexibility, constrainCreativeUrge, vagalForcesTerseRegister } from "@/affect/soma/vagal.ts"
import { computeAttentionState } from "@/cognition/attention.ts"
import { updateBiasModifiers } from "@/cognition/bias/compute.ts"
import { computeMetacognitiveModifiers, updateMetacognitiveState } from "@/cognition/metacognition.ts"
import { computeCommunicationRegister } from "@/expression/communication/register.ts"
import { updateCreativeUrgeState } from "@/expression/creativity/compute.ts"
import { clamp01 } from "@/infra/lib/math.ts"
import { computeSubjectiveTime } from "@/perception/time/compute.ts"
import { DEFAULT_SUBJECTIVE_TIME_STATE } from "@/perception/time/types.ts"
import type { IsolationStress, VulnerabilityState } from "@/relational/attachment/types.ts"
import { computeCoherenceEffect, updateCoherenceState } from "@/self/coherence/compute.ts"
import { processDeceptionCycle } from "@/self/deception/compute.ts"
import { computeDefenseExpressionModifiers, processDefenseCycle } from "@/self/defense/compute.ts"
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
  vagalConstraints: VagalConstraints,
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

  const rawCreativeUrge = updateCreativeUrgeState(prefetch.previousCreativeUrge, {
    emotion,
    driveState,
    heldBackBuffer,
    consecutiveIdleTicks: prefetch.consecutiveIdleTicks
  })
  const creativeUrge = {
    ...rawCreativeUrge,
    level: constrainCreativeUrge(rawCreativeUrge.level, vagalConstraints)
  }

  const selfConceptWithMomentum = applyGrowthArcMomentum(prefetch.selfConcept, prefetch.recentGrowthArcs)

  const updatedDefense = processDefenseCycle(prefetch.previousDefenseState, {
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

  const defenseExpressionModifiers = computeDefenseExpressionModifiers(updatedDefense.activeDefenses)

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
    vagalConstraints
  )
  if (Math.abs(constrainedConfidenceModifier) > 0.01) {
    dampedEmotion = {
      ...dampedEmotion,
      confidence: clamp01(dampedEmotion.confidence + constrainedConfidenceModifier)
    }
  }

  const computedRegister = computeCommunicationRegister(dampedEmotion, soma, vulnerability, shameState, coherenceState)
  const register = vagalForcesTerseRegister(vagalConstraints) ? ("terse" as typeof computedRegister) : computedRegister

  const conversationMessageCount = prefetch.activeConversation?.messages.length ?? 0
  const attentionState = computeAttentionState(
    dampedEmotion,
    soma,
    sense.pendingMessages.length > 0,
    prefetch.consecutiveIdleTicks,
    conversationMessageCount
  )

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
    defenseState: updatedDefense,
    defenseExpressionModifiers,
    biasState: updatedBias
  }
}
