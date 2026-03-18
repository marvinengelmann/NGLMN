import { getFlowQualifyingTicks } from "@/affect/altered/flow/state.ts"
import { getActiveAlteredState } from "@/affect/altered/state.ts"
import { getDriveState } from "@/affect/drive/state.ts"
import { getAllSecondaryEmotionStates } from "@/affect/emotion/batch.ts"
import { getDeferredQueue } from "@/affect/emotion/deferred.ts"
import { getGranularityState } from "@/affect/emotion/granularity/state.ts"
import { getShameState } from "@/affect/emotion/shame.ts"
import {
  getAfterglowEntries,
  getEmotionalMomentum,
  getEmotionalState,
  getRawTriggerTimestamps
} from "@/affect/emotion/state.ts"
import { getNeuromodulatoryState } from "@/affect/neuromodulation/state.ts"
import {
  getAutonomicState,
  getInteroceptiveAccuracy,
  getRecentSomaHistory,
  getSomaticLastTimestamp,
  getSomaticState
} from "@/affect/soma/state.ts"
import { getMetacognitiveState } from "@/cognition/awareness.ts"
import { getBiasState } from "@/cognition/bias/state.ts"
import { getForecastingState } from "@/cognition/forecasting/state.ts"
import { getActiveConversation } from "@/expression/communication/state.ts"
import { getCreativeUrgeState } from "@/expression/creativity/state.ts"
import { getDreamAfterglow } from "@/expression/dream/state.ts"
import { getKnowledge } from "@/memory/semantic.ts"
import { getConsecutiveConversationTicks, getConsecutiveIdleTicks, getRecentActions } from "@/memory/working.ts"
import { getAnticipatoryState } from "@/perception/anticipation/state.ts"
import { getNoveltyState } from "@/perception/novelty/state.ts"
import { getUltradianState } from "@/perception/rhythm/state.ts"
import { getAttachmentStyle, getIsolationStress } from "@/relational/attachment/state.ts"
import { getVulnerabilityPrevLevel } from "@/relational/attachment/store.ts"
import { getOperatorModel, getRelationalPatterns } from "@/relational/mind/state.ts"
import { getRelationalPatternState } from "@/relational/patterns/state.ts"
import { getAggregateTrustExperience } from "@/relational/trust/compute.ts"
import { getBoundaryState } from "@/self/boundaries/state.ts"
import { getDissociativeState } from "@/self/coherence/dissociation/state.ts"
import { getCoherenceState } from "@/self/coherence/state.ts"
import { getDeceptionState } from "@/self/deception/state.ts"
import { getEmotionRegulationState } from "@/self/defense/state.ts"
import { getGenesisBigFive, getGenesisDNA } from "@/self/genesis/state.ts"
import { getHeldBackBuffer } from "@/self/psyche/heldback.ts"
import { getGrowthArcs, getSelfConcept } from "@/self/psyche/state.ts"
import type { FeelPrefetch } from "./types.ts"

export async function prefetchFeelState(): Promise<FeelPrefetch> {
  const [
    genesisDNA,
    currentEmotion,
    previousMomentum,
    existingAfterglow,
    dreamAfterglow,
    alteredState,
    previousDriveState,
    consecutiveIdleTicks,
    currentSoma,
    lastSomaTimestamp,
    selfConcept,
    attachmentStyle,
    trustExperience,
    previousOperatorModel,
    deceptionState,
    activeConversation,
    consecutiveConversationTicks,
    previousShameState,
    previousAnticipation,
    previousBoundaryState,
    previousNovelty,
    previousCoherence,
    previousMetacognition,
    previousCreativeUrge,
    vulnerabilityPrevLevel,
    triggerTimestamps,
    recentActions,
    recentGrowthArcs,
    heldBackBuffer,
    previousSecondaryEmotionStates,
    selfInsightsResult,
    relationalPatterns,
    deferredQueue,
    previousAutonomicState,
    interoceptiveAccuracy,
    recentSomaHistory,
    previousNeuromodulatoryState,
    previousIsolationStress,
    previousBiasState,
    previousEmotionRegulationState
  ] = await Promise.all([
    getGenesisDNA(),
    getEmotionalState(),
    getEmotionalMomentum(),
    getAfterglowEntries(),
    getDreamAfterglow(),
    getActiveAlteredState(),
    getDriveState(),
    getConsecutiveIdleTicks(),
    getSomaticState(),
    getSomaticLastTimestamp(),
    getSelfConcept(),
    getAttachmentStyle(),
    getAggregateTrustExperience(),
    getOperatorModel(),
    getDeceptionState(),
    getActiveConversation(),
    getConsecutiveConversationTicks(),
    getShameState(),
    getAnticipatoryState(),
    getBoundaryState(),
    getNoveltyState(),
    getCoherenceState(),
    getMetacognitiveState(),
    getCreativeUrgeState(),
    getVulnerabilityPrevLevel(),
    getRawTriggerTimestamps(),
    getRecentActions(),
    getGrowthArcs(),
    getHeldBackBuffer(),
    getAllSecondaryEmotionStates(),
    getKnowledge({ category: "insight", scope: "self" }),
    getRelationalPatterns(),
    getDeferredQueue(),
    getAutonomicState(),
    getInteroceptiveAccuracy(),
    getRecentSomaHistory(),
    getNeuromodulatoryState(),
    getIsolationStress(),
    getBiasState(),
    getEmotionRegulationState()
  ])

  const [
    previousGranularity,
    previousForecastingState,
    previousUltradian,
    previousRelationalPatternState,
    previousDissociativeState,
    flowQualifyingTicks,
    bigFive
  ] = await Promise.all([
    getGranularityState(),
    getForecastingState(),
    getUltradianState(),
    getRelationalPatternState(),
    getDissociativeState(),
    getFlowQualifyingTicks(),
    getGenesisBigFive()
  ])

  return {
    dnaBaseline: genesisDNA?.emotionalBaseline ?? null,
    currentEmotion,
    previousMomentum,
    existingAfterglow,
    dreamAfterglow,
    alteredState,
    previousDriveState,
    consecutiveIdleTicks,
    currentSoma,
    lastSomaTimestamp,
    selfConcept,
    attachmentStyle,
    trustExperience,
    previousOperatorModel,
    deceptionState,
    activeConversation,
    consecutiveConversationTicks,
    previousShameState,
    previousAnticipation,
    previousBoundaryState,
    previousNovelty,
    previousCoherence,
    previousMetacognition,
    previousCreativeUrge,
    vulnerabilityPrevLevel,
    triggerTimestamps,
    recentActions,
    recentGrowthArcs,
    heldBackBuffer,
    previousSecondaryEmotionStates,
    selfInsights: selfInsightsResult.unwrapOr([]),
    relationalPatterns,
    deferredQueue,
    previousAutonomicState,
    interoceptiveAccuracy,
    recentSomaHistory,
    previousNeuromodulatoryState,
    previousIsolationStress,
    previousBiasState,
    previousEmotionRegulationState,
    previousGranularity,
    previousForecastingState,
    previousUltradian,
    previousRelationalPatternState,
    previousDissociativeState,
    flowQualifyingTicks,
    neuroticism: bigFive.neuroticism
  }
}
