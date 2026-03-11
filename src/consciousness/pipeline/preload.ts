import { getActiveAlteredState } from "@/affect/altered/state.ts"
import { getEmotionHistory } from "@/affect/emotion/state.ts"
import type { EmotionalState } from "@/affect/emotion/types.ts"
import { computeEmotionalIntensity } from "@/affect/emotion/update.ts"
import { getLastInnerDialog } from "@/cognition/polyphony/state.ts"
import { getIdiolectState } from "@/expression/communication/idiolect.ts"
import { getConversationBuffer } from "@/expression/communication/state.ts"
import { getDreamAfterglow, getDreamInsights, getDreamLastRun, getDreamState } from "@/expression/dream/state.ts"
import { getRecentChangelog } from "@/governance/evolution/changelog.ts"
import { getEvolutionCycleResult, getPendingEvolutionProposal } from "@/governance/evolution/state.ts"
import { CONTEXT_LIMITS } from "@/infra/config/constants.ts"
import { redis } from "@/infra/integrations/redis.ts"
import { queryRelatedWithDistortion, queryRelationshipHistory } from "@/memory/episodic.ts"
import { getGoalsByPriority } from "@/memory/goals.ts"
import { getRelationalMemoryState } from "@/memory/relational.ts"
import { getKnowledge, getOperatorLanguage } from "@/memory/semantic.ts"
import {
  getConsecutiveIdleTicks,
  getLastTickSummary,
  getRecentTickDurations,
  getReflectionLastAt
} from "@/memory/working.ts"
import { getAttachmentStyle, getRelationshipPhase } from "@/relational/attachment/state.ts"
import { getAllTrustLevels } from "@/relational/trust/compute.ts"
import { getExistentialQuestions } from "@/self/psyche/questions.ts"
import { getGrowthArcs, getIdentityStatements, getRecentNarratives, getSelfConcept } from "@/self/psyche/state.ts"
import type { SenseData } from "../types.ts"
import type { PreloadedState } from "./types.ts"

export async function preloadContextState(senseData: SenseData, emotion: EmotionalState): Promise<PreloadedState> {
  const emotionIntensity = computeEmotionalIntensity(emotion)

  const [
    lastTick,
    conversationBuffer,
    emotionHistory,
    episodes,
    relationships,
    knowledge,
    operatorLanguage,
    goals,
    trustLevels,
    evolutionHistory,
    evolutionOutcome,
    pendingProposal,
    dreamState,
    dreamLastRun,
    dreamInsights,
    reflectionLastAt,
    selfConcept,
    attachmentStyle,
    lastInnerDialog,
    relationshipPhase,
    existentialQuestions,
    identityStatements,
    growthArcs,
    recentNarratives,
    dreamAfterglow,
    alteredState,
    idiolectState,
    relationalMemoryState
  ] = await Promise.all([
    getLastTickSummary(),
    getConversationBuffer(),
    getEmotionHistory(CONTEXT_LIMITS.maxEmotionHistory),
    senseData.pendingMessages.length > 0
      ? queryRelatedWithDistortion(
          senseData.pendingMessages.map((m) => m.text).join(" "),
          CONTEXT_LIMITS.maxEpisodes,
          emotionIntensity
        )
      : queryRelatedWithDistortion("recent activity", CONTEXT_LIMITS.maxEpisodes, emotionIntensity),
    queryRelationshipHistory(CONTEXT_LIMITS.maxRelationship),
    getKnowledge({ limit: CONTEXT_LIMITS.maxSemantic }),
    getOperatorLanguage(),
    getGoalsByPriority(CONTEXT_LIMITS.maxGoals, emotion),
    getAllTrustLevels(),
    getRecentChangelog(5),
    getEvolutionCycleResult(),
    getPendingEvolutionProposal(),
    getDreamState(),
    getDreamLastRun(),
    getDreamInsights(),
    getReflectionLastAt(),
    getSelfConcept(),
    getAttachmentStyle(),
    getLastInnerDialog(),
    getRelationshipPhase(),
    getExistentialQuestions(),
    getIdentityStatements(),
    getGrowthArcs(),
    getRecentNarratives(),
    getDreamAfterglow(),
    getActiveAlteredState(),
    getIdiolectState(),
    getRelationalMemoryState()
  ])

  const [recentTickDurations, consecutiveIdleTicks, cachedPatterns] = await Promise.all([
    getRecentTickDurations(),
    getConsecutiveIdleTicks(),
    redis.get<{ patterns: string[]; recurringUnresolved: string[] }>("working:conversation:patterns")
  ])

  const knowledgeItems = knowledge.unwrapOr([])
  const recentCounterfactuals = knowledgeItems
    .filter((k) => typeof k.key === "string" && k.key.startsWith("counterfactual-"))
    .map((k) => String(k.value))
    .slice(0, 3)

  return {
    lastTick,
    conversationBuffer,
    emotionHistory,
    episodes,
    relationships,
    knowledge,
    operatorLanguage,
    goals,
    trustLevels,
    evolutionHistory,
    evolutionOutcome,
    pendingProposal,
    dreamState,
    dreamLastRun,
    dreamInsights,
    reflectionLastAt,
    selfConcept,
    attachmentStyle,
    lastInnerDialog,
    relationshipPhase,
    existentialQuestions,
    identityStatements,
    growthArcs,
    recentNarratives,
    dreamAfterglow,
    alteredState,
    idiolectState,
    relationalMemoryState,
    recentTickDurations,
    consecutiveIdleTicks,
    recentCounterfactuals,
    conversationPatterns: cachedPatterns?.patterns ?? [],
    recurringUnresolved: cachedPatterns?.recurringUnresolved ?? []
  }
}
