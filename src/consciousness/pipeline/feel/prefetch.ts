import { getActiveAlteredState } from "@/affect/altered/state.ts"
import { getDriveState } from "@/affect/drive/state.ts"
import { getShameState } from "@/affect/emotion/shame.ts"
import {
  getAfterglowEntries,
  getEmotionalMomentum,
  getEmotionalState,
  getRawTriggerTimestamps
} from "@/affect/emotion/state.ts"
import { getSomaticLastTimestamp, getSomaticState } from "@/affect/soma/state.ts"
import { getMetacognitiveState } from "@/cognition/awareness.ts"
import { getActiveConversation } from "@/expression/communication/state.ts"
import { getCreativeUrgeState } from "@/expression/creativity/state.ts"
import { getDreamAfterglow } from "@/expression/dream/state.ts"
import { getConsecutiveConversationTicks, getConsecutiveIdleTicks, getRecentActions } from "@/memory/working.ts"
import { getAnticipatoryState } from "@/perception/anticipation/state.ts"
import { getNoveltyState } from "@/perception/novelty/state.ts"
import { getAttachmentStyle } from "@/relational/attachment/state.ts"
import { getVulnerabilityPrevLevel } from "@/relational/attachment/store.ts"
import { getOperatorModel } from "@/relational/mind/state.ts"
import { getAggregateTrustExperience } from "@/relational/trust/compute.ts"
import { getBoundaryState } from "@/self/boundaries/state.ts"
import { getCoherenceState } from "@/self/coherence/state.ts"
import { getDeceptionState } from "@/self/deception/state.ts"
import { getGrowthArcs, getSelfConcept } from "@/self/psyche/state.ts"
import type { FeelPrefetch } from "./types.ts"

export async function prefetchFeelState(): Promise<FeelPrefetch> {
  const [
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
    recentGrowthArcs
  ] = await Promise.all([
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
    getGrowthArcs()
  ])

  return {
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
    recentGrowthArcs
  }
}
