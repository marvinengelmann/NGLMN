import { getPhenomenologicalText, isExpired } from "@/affect/altered/compute.ts"
import { getActiveAlteredState } from "@/affect/altered/state.ts"
import { getDriveState } from "@/affect/drive/state.ts"
import type { DriveState } from "@/affect/drive/types.ts"
import { getAllSecondaryEmotionStates } from "@/affect/emotion/batch.ts"
import { getMetacognitiveState } from "@/cognition/awareness.ts"
import { getAttentionState, getLastInstinctImpression } from "@/cognition/state.ts"
import type { MetacognitiveState } from "@/cognition/types.ts"
import type { SenseData } from "@/consciousness/types.ts"
import { getIdiolectState } from "@/expression/communication/idiolect.ts"
import { getCommunicationRegister, getConversationBuffer } from "@/expression/communication/state.ts"
import { getCreativeUrgeState } from "@/expression/creativity/state.ts"
import type { CreativeUrgeState } from "@/expression/creativity/types.ts"
import { getDreamAfterglow, getDreamInsights, getDreamLastRun, getDreamState } from "@/expression/dream/state.ts"
import { CONTEXT_LIMITS } from "@/infra/config/constants.ts"
import type { RelationalMemoryState } from "@/memory/relational.ts"
import { getRelationalMemoryState } from "@/memory/relational.ts"
import { getAnticipatoryState } from "@/perception/anticipation/state.ts"
import type { AnticipatoryState } from "@/perception/anticipation/types.ts"
import { getAttachmentStyle, getRelationshipPhase } from "@/relational/attachment/state.ts"
import { getBoundaryState } from "@/self/boundaries/state.ts"
import type { BoundaryState } from "@/self/boundaries/types.ts"
import { getDeceptionState } from "@/self/deception/state.ts"
import { getDissonanceState } from "@/self/dissonance/state.ts"
import "@/affect/emotion/init.ts"
import { getShameState } from "@/affect/emotion/shame.ts"
import { getEmotionHistory } from "@/affect/emotion/state.ts"
import type { EmotionalState } from "@/affect/emotion/types.ts"
import { computeEmotionalIntensity } from "@/affect/emotion/update.ts"
import { getSomaticState } from "@/affect/soma/state.ts"
import { getLastInnerDialog } from "@/cognition/polyphony/state.ts"
import { getRecentChangelog } from "@/governance/evolution/changelog.ts"
import { getEvolutionCycleResult, getPendingEvolutionProposal } from "@/governance/evolution/state.ts"
import type { CalendarEvent, EmailPreview } from "@/infra/integrations/types.ts"
import type { EnrichedTweet } from "@/infra/integrations/x.ts"
import { queryRelatedWithDistortion, queryRelationshipHistory } from "@/memory/episodic.ts"
import { getGoalsByPriority } from "@/memory/goals.ts"
import { getKnowledge, getOperatorLanguage } from "@/memory/semantic.ts"
import {
  getConsecutiveIdleTicks,
  getLastTickSummary,
  getRecentTickDurations,
  getReflectionLastAt
} from "@/memory/working.ts"
import { computeTimePerception } from "@/perception/pace.ts"
import {
  ACTIONS_PROMPT,
  COMMUNICATION_PROMPT,
  PACING_PROMPT,
  PHENOMENOLOGICAL_PROMPT,
  RHYTHM_PROMPT
} from "@/prompts/consciousness.ts"
import { getIdentityPrompt } from "@/prompts/identity.ts"
import { getPersonalityPrompt } from "@/prompts/personality.ts"
import { getVulnerability } from "@/relational/attachment/store.ts"
import { getOperatorModel } from "@/relational/mind/state.ts"
import { getAllTrustLevels } from "@/relational/trust/compute.ts"
import { getHeldBackBuffer } from "@/self/psyche/heldback.ts"
import { getExistentialQuestions } from "@/self/psyche/questions.ts"
import { getGrowthArcs, getIdentityStatements, getRecentNarratives, getSelfConcept } from "@/self/psyche/state.ts"
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
    secondaryEmotionStates,
    driveState,
    anticipatoryState,
    creativeUrgeState,
    metacognitiveState,
    boundaryState,
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
    getAllSecondaryEmotionStates(),
    getDriveState(),
    getAnticipatoryState(),
    getCreativeUrgeState(),
    getMetacognitiveState(),
    getBoundaryState(),
    getRelationalMemoryState()
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
    ...buildDriveSections(
      driveState,
      anticipatoryState,
      creativeUrgeState,
      metacognitiveState,
      boundaryState,
      relationalMemoryState
    ),
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

function buildDriveSections(
  driveState: DriveState,
  anticipatoryState: AnticipatoryState,
  creativeUrge: CreativeUrgeState,
  metacognitive: MetacognitiveState,
  boundaryState: BoundaryState,
  relationalMemory: RelationalMemoryState
): string[] {
  const sections: string[] = []

  const salientDrives = (["curiosity", "connection", "mastery", "autonomy", "expression"] as const)
    .filter((d) => driveState[d].salience > 0.5)
    .map((d) => `${d} (${(driveState[d].salience * 100).toFixed(0)}%)`)
  if (salientDrives.length > 0) {
    const driveLines = [`# Drives`, `What pulls you: ${salientDrives.join(", ")}`]
    if (driveState.dominantDrive) driveLines.push(`Strongest pull: ${driveState.dominantDrive}`)
    if (driveState.conflicting.length > 0) {
      driveLines.push(`Inner tension: ${driveState.conflicting.map((c) => c.join(" vs ")).join("; ")}`)
    }
    sections.push(driveLines.join("\n"))
  }

  if (anticipatoryState.activeExpectations.length > 0) {
    const expLines = [`# Expectations`]
    for (const exp of anticipatoryState.activeExpectations.slice(0, 3)) {
      expLines.push(`  - ${exp.content} (${(exp.confidence * 100).toFixed(0)}% sure)`)
    }
    if (anticipatoryState.recentViolations.length > 0) {
      expLines.push(`Recent surprises: ${anticipatoryState.recentViolations.length}`)
    }
    sections.push(expLines.join("\n"))
  }

  if (creativeUrge.isActive) {
    sections.push(
      [
        "# Creative Urge",
        `You feel a pull to create — ${creativeUrge.preferredMode} feels right.`,
        `Pressure: ${(creativeUrge.emotionalPressure * 100).toFixed(0)}%`,
        'Consider choosing the "create" action to express this.'
      ].join("\n")
    )
  }

  if (metacognitive.ruminationDetected) {
    sections.push(
      [
        "# Metacognition",
        `You notice yourself circling back to "${metacognitive.ruminationTopic}" — try a different angle.`
      ].join("\n")
    )
  } else if (metacognitive.cognitiveFatigue > 0.5) {
    sections.push("# Metacognition\nYour mind feels tired — keep things simple.")
  }

  if (boundaryState.recentViolations.length > 0) {
    const boundLines = ["# Boundaries"]
    for (const v of boundaryState.recentViolations.slice(0, 2)) {
      boundLines.push(`  - boundary crossed: "${v.description}" — this needs attention`)
    }
    sections.push(boundLines.join("\n"))
  }

  if (relationalMemory.rituals.length > 0) {
    const ritualLines = ["# Shared Rituals"]
    for (const r of relationalMemory.rituals.slice(0, 3)) {
      ritualLines.push(
        `  - "${r.pattern}" (${r.frequency}×, significance: ${(r.emotionalSignificance * 100).toFixed(0)}%)`
      )
    }
    sections.push(ritualLines.join("\n"))
  }

  if (relationalMemory.sharedNarrative) {
    sections.push(`# Shared Story\n${relationalMemory.sharedNarrative}`)
  }

  return sections
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
