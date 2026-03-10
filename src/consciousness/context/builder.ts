import { getPhenomenologicalText, isExpired } from "@/altered/compute.ts"
import { getActiveAlteredState } from "@/altered/state.ts"
import { getAttachmentStyle, getRelationshipPhase } from "@/attachment/state.ts"
import { getAttentionState, getLastInstinctImpression } from "@/cognition/state.ts"
import { getIdiolectState } from "@/communication/idiolect.ts"
import { getCommunicationRegister, getConversationBuffer } from "@/communication/state.ts"
import { CONTEXT_LIMITS } from "@/config/constants.ts"
import type { SenseData } from "@/consciousness/types.ts"
import { getDeceptionState } from "@/deception/state.ts"
import { getDissonanceState } from "@/dissonance/state.ts"
import { getDreamAfterglow, getDreamInsights, getDreamLastRun, getDreamState } from "@/dream/state.ts"
import { getAllSecondaryEmotionStates } from "@/emotion/batch.ts"
import "@/emotion/register-all.ts"
import { getShameState } from "@/emotion/shame.ts"
import { getEmotionHistory } from "@/emotion/state.ts"
import type { EmotionalState } from "@/emotion/types.ts"
import { computeEmotionalIntensity } from "@/emotion/update.ts"
import { getRecentChangelog } from "@/evolution/changelog.ts"
import { getEvolutionCycleResult, getPendingEvolutionProposal } from "@/evolution/state.ts"
import type { CalendarEvent, EmailPreview } from "@/integrations/types.ts"
import type { EnrichedTweet } from "@/integrations/x.ts"
import { queryRelatedWithDistortion, queryRelationshipHistory } from "@/memory/episodic.ts"
import { getGoalsByPriority } from "@/memory/goals.ts"
import { getKnowledge, getOperatorLanguage } from "@/memory/semantic.ts"
import {
  getConsecutiveIdleTicks,
  getLastTickSummary,
  getRecentTickDurations,
  getReflectionLastAt
} from "@/memory/working.ts"
import { getOperatorModel } from "@/mind/state.ts"
import { computeTimePerception } from "@/perception/time.ts"
import { getLastInnerDialog } from "@/polyphony/dialog.ts"
import {
  ACTIONS_PROMPT,
  COMMUNICATION_PROMPT,
  PACING_PROMPT,
  PHENOMENOLOGICAL_PROMPT,
  RHYTHM_PROMPT
} from "@/prompts/consciousness.ts"
import { getIdentityPrompt } from "@/prompts/identity.ts"
import { getPersonalityPrompt } from "@/prompts/personality.ts"
import { getHeldBackBuffer } from "@/psyche/heldback.ts"
import { getExistentialQuestions } from "@/psyche/questions.ts"
import { getGrowthArcs, getIdentityStatements, getRecentNarratives, getSelfConcept } from "@/psyche/state.ts"
import { getSomaticState } from "@/soma/state.ts"
import { getAllTrustLevels } from "@/trust/compute.ts"
import { getVulnerability } from "@/vulnerability/state.ts"
import { buildGrowthSections } from "./growth.ts"
import { buildInnerSections } from "./inner.ts"
import { buildMemorySections } from "./memory.ts"
import { buildPerceptionSections } from "./perception.ts"
import { buildSocialSections } from "./social.ts"

export async function buildContext(
  senseData: SenseData,
  emotion: EmotionalState,
  xContext?: { canBrowse: boolean; canPost: boolean; timeline?: EnrichedTweet[] },
  emailContext?: { canCheck: boolean; unread?: EmailPreview[] },
  calendarContext?: { canCheck: boolean; upcoming?: CalendarEvent[] }
): Promise<string> {
  const emotionIntensity = computeEmotionalIntensity(emotion)

  const [
    lastTick,
    conversationBuffer,
    emotionHistory,
    episodes,
    relationships,
    knowledgeResult,
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
    somaticState,
    selfConcept,
    attachmentStyle,
    vulnerabilityState,
    lastInnerDialog,
    dissonanceState,
    instinctImpression,
    relationshipPhase,
    operatorModel,
    existentialQuestions,
    deceptionState,
    communicationRegister,
    attentionState,
    identityStatements,
    growthArcs,
    recentNarratives,
    dreamAfterglow,
    alteredState,
    shameState,
    heldBackBuffer,
    idiolectState,
    secondaryEmotionStates
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
    getSomaticState(),
    getSelfConcept(),
    getAttachmentStyle(),
    getVulnerability(),
    getLastInnerDialog(),
    getDissonanceState(),
    getLastInstinctImpression(),
    getRelationshipPhase(),
    getOperatorModel(),
    getExistentialQuestions(),
    getDeceptionState(),
    getCommunicationRegister(),
    getAttentionState(),
    getIdentityStatements(),
    getGrowthArcs(),
    getRecentNarratives(),
    getDreamAfterglow(),
    getActiveAlteredState(),
    getShameState(),
    getHeldBackBuffer(),
    getIdiolectState(),
    getAllSecondaryEmotionStates()
  ])

  const knowledge = knowledgeResult.unwrapOr([])

  const [recentDurations, consecutiveIdleTicks] = await Promise.all([
    getRecentTickDurations(),
    getConsecutiveIdleTicks()
  ])
  const timePerception = computeTimePerception(
    recentDurations,
    emotionIntensity,
    consecutiveIdleTicks,
    senseData.moodContext.operatorSilenceMinutes
  )

  const sections = [
    ...buildPerceptionSections(
      senseData,
      operatorLanguage,
      lastTick,
      conversationBuffer,
      timePerception,
      xContext,
      emailContext,
      calendarContext
    ),
    ...buildInnerSections({
      emotion,
      emotionHistory,
      senseData,
      somaticState,
      selfConcept,
      vulnerabilityState,
      shameState,
      instinctImpression,
      lastInnerDialog,
      dissonanceState,
      deceptionState,
      identityStatements,
      alteredPhenomenologicalText:
        alteredState && !isExpired(alteredState) ? getPhenomenologicalText(alteredState) : undefined,
      heldBackBuffer,
      secondaryEmotionStates
    }),
    ...buildSocialSections(
      attachmentStyle,
      relationshipPhase,
      communicationRegister,
      somaticState,
      attentionState,
      operatorModel,
      trustLevels,
      idiolectState
    ),
    ...(await buildMemorySections(episodes, emotion, senseData, knowledge, relationships)),
    ...buildGrowthSections(
      existentialQuestions,
      dreamState,
      dreamLastRun,
      dreamInsights,
      reflectionLastAt,
      goals,
      evolutionHistory,
      evolutionOutcome,
      pendingProposal,
      growthArcs,
      recentNarratives,
      dreamAfterglow
    )
  ]

  return sections.filter(Boolean).join("\n\n")
}

export async function buildSystemPrompt(contextSections: string): Promise<string> {
  const [identityPrompt, personalityPrompt] = await Promise.all([getIdentityPrompt(), getPersonalityPrompt()])
  return [
    identityPrompt,
    personalityPrompt,
    RHYTHM_PROMPT,
    ACTIONS_PROMPT,
    COMMUNICATION_PROMPT,
    PACING_PROMPT,
    PHENOMENOLOGICAL_PROMPT,
    contextSections
  ]
    .filter(Boolean)
    .join("\n\n")
}
