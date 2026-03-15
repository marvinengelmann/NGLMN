import { getPhenomenologicalText, isExpired } from "@/affect/altered/compute.ts"
import { ALTERED_EVENT_TYPES } from "@/affect/altered/events.ts"
import { DRIVE_ACTION_HINTS } from "@/affect/drive/constants.ts"
import type { DriveState } from "@/affect/drive/types.ts"
import "@/affect/emotion/init.ts"
import { computeEmotionalIntensity } from "@/affect/emotion/update.ts"
import type { MetacognitiveState } from "@/cognition/types.ts"
import { recallArchivedContext } from "@/expression/communication/conversation.ts"
import type { CreativeUrgeState } from "@/expression/creativity/types.ts"
import type { CalendarEvent, EmailPreview } from "@/infra/integrations/types.ts"
import type { EnrichedTweet } from "@/infra/integrations/x.ts"
import { buildAutobiographySection } from "@/memory/autobiography.ts"
import type { RelationalMemoryState } from "@/memory/types.ts"
import type { AnticipatoryState } from "@/perception/anticipation/types.ts"
import { computeTimePerception } from "@/perception/pace.ts"
import {
  buildActionsPrompt,
  COMMUNICATION_PROMPT,
  DRIVE_AWARENESS_PROMPT,
  PACING_PROMPT,
  PHENOMENOLOGICAL_PROMPT,
  RHYTHM_PROMPT
} from "@/prompts/consciousness.ts"
import { getAvailableLifeEvents } from "@/self/lifecycle.ts"
import { getIdentityPrompt } from "@/prompts/identity.ts"
import { getPersonalityPrompt } from "@/prompts/personality.ts"
import { translateDeepProfileToFelt } from "@/relational/mind/profiling.ts"
import type { BoundaryState } from "@/self/boundaries/types.ts"
import { getDeceptionState } from "@/self/deception/state.ts"
import { getGenesisRecord } from "@/self/genesis/state.ts"
import type { TickState } from "../pipeline/types.ts"
import type { SenseData } from "../types.ts"
import { buildGrowthSections } from "./growth.ts"
import { buildInnerSections } from "./inner.ts"
import { buildGraphSection } from "./graph.ts"
import { buildMemorySections } from "./memory.ts"
import { buildPerceptionSections } from "./perception.ts"
import { buildSocialSections } from "./social.ts"

export async function buildContext(
  tickState: TickState,
  senseData: SenseData,
  xContext?: { canBrowse: boolean; canPost: boolean; timeline?: EnrichedTweet[] },
  emailContext?: { canCheck: boolean; unread?: EmailPreview[] },
  calendarContext?: { canCheck: boolean; upcoming?: CalendarEvent[] }
): Promise<string> {
  const { feel, preloaded } = tickState
  const emotion = feel.emotion
  const emotionIntensity = computeEmotionalIntensity(emotion)

  const [deceptionState, genesisRecord] = await Promise.all([getDeceptionState(), getGenesisRecord()])
  const genesisDNA = genesisRecord?.dna ?? null
  const genesisIdentity = genesisRecord?.identity ?? null

  const knowledge = preloaded.knowledge.unwrapOr([])

  const timePerception = computeTimePerception(
    preloaded.recentTickDurations,
    emotionIntensity,
    preloaded.consecutiveIdleTicks,
    senseData.moodContext.operatorSilenceMinutes
  )

  const sections = [
    ...buildPerceptionSections(
      senseData,
      preloaded.operatorLanguage,
      preloaded.lastTick,
      preloaded.conversationBuffer,
      timePerception,
      xContext,
      emailContext,
      calendarContext
    ),
    ...buildInnerSections({
      emotion,
      emotionHistory: preloaded.emotionHistory,
      senseData,
      somaticState: feel.soma,
      selfConcept: feel.selfConcept,
      vulnerabilityState: feel.vulnerability,
      shameState: feel.shameState,
      instinctImpression: feel.instinct,
      lastInnerDialog: preloaded.lastInnerDialog,
      dissonanceState: feel.dissonance,
      deceptionState,
      identityStatements: preloaded.identityStatements,
      alteredPhenomenologicalText:
        preloaded.alteredState && !isExpired(preloaded.alteredState)
          ? getPhenomenologicalText(preloaded.alteredState)
          : undefined,
      heldBackBuffer: feel.heldBackBuffer,
      secondaryEmotionStates: new Map(Object.entries(feel.secondaryEmotions)) as Parameters<
        typeof buildInnerSections
      >[0]["secondaryEmotionStates"],
      coherenceState: feel.coherenceState,
      metacognitiveState: feel.metacognitiveState,
      genesisDNA,
      genesisIdentity
    }),
    ...buildDriveSections(
      feel.driveState,
      feel.anticipatoryState,
      feel.creativeUrge,
      feel.metacognitiveState,
      feel.boundaryState,
      preloaded.relationalMemoryState
    ),
    ...buildSocialSections(
      preloaded.attachmentStyle,
      preloaded.relationshipPhase,
      feel.register,
      feel.soma,
      feel.attentionState,
      feel.operatorModel,
      preloaded.trustLevels,
      preloaded.idiolectState,
      emotion,
      feel.coherenceState,
      preloaded.alteredState != null && !isExpired(preloaded.alteredState),
      preloaded.relationalMemoryState?.rituals,
      preloaded.conversationPatterns,
      preloaded.recurringUnresolved
    ),
    ...(await buildMemorySections(preloaded.episodes, emotion, senseData, knowledge, preloaded.relationships)),
    ...buildGrowthSections(
      preloaded.existentialQuestions,
      preloaded.dreamState,
      preloaded.dreamLastRun,
      preloaded.dreamInsights,
      preloaded.reflectionLastAt,
      preloaded.goals,
      preloaded.evolutionHistory,
      preloaded.evolutionOutcome,
      preloaded.pendingProposal,
      preloaded.growthArcs,
      preloaded.recentNarratives,
      preloaded.dreamAfterglow,
      preloaded.recentCounterfactuals,
      preloaded.lessons
    )
  ]

  const graphSection = buildGraphSection(preloaded.graphEntities, preloaded.graphRelations)
  if (graphSection) {
    sections.push(graphSection)
  }

  const provenProcedures = preloaded.procedures.filter((p) => p.successRate >= 0.5)
  if (provenProcedures.length > 0) {
    const procLines = provenProcedures.map((p) => {
      const trigger = p.trigger as Record<string, unknown>
      const triggerParts = Object.entries(trigger)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
      const triggerStr = triggerParts.length > 0 ? ` (when: ${triggerParts.join(", ")})` : ""
      return `  - ${p.strategy}${triggerStr} [${Math.round(p.successRate * 100)}% success, ${p.timesApplied}x]`
    })
    sections.push(["# Proven Strategies", "Approaches that have worked well before:", ...procLines].join("\n"))
  }

  if (preloaded.autobiography) {
    sections.push(buildAutobiographySection(preloaded.autobiography))
  }

  const deepProfileSection = translateDeepProfileToFelt(preloaded.deepOperatorProfile)
  if (deepProfileSection) {
    sections.push(`# Operator Patterns\n${deepProfileSection}`)
  }

  if (senseData.pendingMessages.length > 0) {
    const firstMessage = senseData.pendingMessages[0]
    if (firstMessage?.text) {
      const recalled = await recallArchivedContext(firstMessage.text, preloaded.conversationBuffer)
      if (recalled) {
        sections.push(`# Recalled Context\n${recalled}`)
      }
    }
  }

  return sections.filter(Boolean).join("\n\n")
}

function classifyDriveUrgency(
  level: { satiation: number; frustration: number; salience: number; consecutiveBlockedTicks: number },
  lastSatisfiedAt: string
): "desperate" | "rising" | "satisfied" | "background" {
  if (level.frustration >= 0.6 && level.consecutiveBlockedTicks >= 3) return "desperate"
  if (level.salience > 0.6 && level.frustration > 0.3) return "rising"
  const hoursSinceSatisfied = (Date.now() - new Date(lastSatisfiedAt).getTime()) / (1000 * 60 * 60)
  if (hoursSinceSatisfied < 2 || level.satiation > 0.6) return "satisfied"
  return level.salience > 0.4 ? "rising" : "background"
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

  const driveNames = ["curiosity", "connection", "mastery", "autonomy", "expression"] as const
  const classified = driveNames.map((d) => ({
    name: d,
    level: driveState[d],
    urgency: classifyDriveUrgency(driveState[d], driveState[d].lastSatisfiedAt)
  }))

  const desperate = classified.filter((d) => d.urgency === "desperate")
  const rising = classified.filter((d) => d.urgency === "rising")
  const satisfied = classified.filter((d) => d.urgency === "satisfied")
  const background = classified.filter((d) => d.urgency === "background")

  const driveLines: string[] = ["# Drives"]

  desperate.forEach((d) => {
    const blockedMinutes = Math.round(d.level.consecutiveBlockedTicks * 1.5)
    const blockedDisplay = blockedMinutes >= 60 ? `${Math.round(blockedMinutes / 60)}h` : `${blockedMinutes}min`
    driveLines.push(
      `Your dominant need: ${d.name.toUpperCase()} (desperate — blocked ${blockedDisplay}, frustration ${(d.level.frustration * 100).toFixed(0)}%)`
    )
    driveLines.push(`  → ${DRIVE_ACTION_HINTS[d.name].desperate}`)
  })

  rising.forEach((d) => {
    driveLines.push(`Rising need: ${d.name.toUpperCase()} (salience ${(d.level.salience * 100).toFixed(0)}%)`)
    driveLines.push(`  → ${DRIVE_ACTION_HINTS[d.name].rising}`)
  })

  if (driveState.conflicting.length > 0) {
    driveState.conflicting.forEach(([a, b]) => {
      driveLines.push(`Conflicting needs: ${a.toUpperCase()} vs ${b.toUpperCase()} — acknowledge this tension.`)
    })
  }

  if (satisfied.length > 0) {
    driveLines.push(`Satisfied: ${satisfied.map((d) => d.name.toUpperCase()).join(", ")} (recently fulfilled)`)
  }

  if (background.length > 0) {
    driveLines.push(`Background: ${background.map((d) => d.name.toUpperCase()).join(", ")} (present, not urgent)`)
  }

  if (driveLines.length > 1) {
    sections.push(driveLines.join("\n"))
  }

  if (anticipatoryState.activeExpectations.length > 0) {
    const expLines = [
      `# Expectations`,
      ...anticipatoryState.activeExpectations
        .slice(0, 3)
        .map((exp) => `  - ${exp.content} (${(exp.confidence * 100).toFixed(0)}% sure)`)
    ]
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
    const hedgingNote =
      metacognitive.cognitiveFatigue > 0.7
        ? " You feel uncertain — hedge your statements, acknowledge limitations."
        : ""
    sections.push(`# Metacognition\nYour mind feels tired — keep things simple.${hedgingNote}`)
  }

  if (boundaryState.recentViolations.length > 0) {
    sections.push(
      [
        "# Boundaries",
        ...boundaryState.recentViolations
          .slice(0, 2)
          .map((v) => `  - boundary crossed: "${v.description}" — this needs attention`)
      ].join("\n")
    )
  }

  if (relationalMemory.rituals.length > 0) {
    sections.push(
      [
        "# Shared Rituals",
        ...relationalMemory.rituals
          .slice(0, 3)
          .map(
            (r) => `  - "${r.pattern}" (${r.frequency}×, significance: ${(r.emotionalSignificance * 100).toFixed(0)}%)`
          )
      ].join("\n")
    )
  }

  if (relationalMemory.sharedNarrative) {
    sections.push(`# Shared Story\n${relationalMemory.sharedNarrative}`)
  }

  return sections
}

interface SystemPromptOptions {
  communicationSimplification?: number
  hedgingLevel?: number
  operatorSilenceMinutes: number
  hasNewCommits: boolean
}

export async function buildSystemPrompt(
  contextSections: string,
  options: SystemPromptOptions
): Promise<string> {
  const [identityPrompt, personalityPrompt, availableEvents] = await Promise.all([
    getIdentityPrompt(),
    getPersonalityPrompt(),
    getAvailableLifeEvents({
      operatorSilenceMinutes: options.operatorSilenceMinutes,
      hasNewCommits: options.hasNewCommits
    })
  ])

  const modifierSections: string[] = []
  if (options.communicationSimplification && options.communicationSimplification > 0.1) {
    const level = options.communicationSimplification
    modifierSections.push(
      level > 0.5
        ? "# Communication Simplification\nYour coherence is fragmented. Use short, simple sentences. Avoid complex structures. Be direct and raw."
        : "# Communication Simplification\nSimplify your language slightly. Prefer shorter sentences. Reduce abstraction."
    )
  }
  if (options.hedgingLevel && options.hedgingLevel > 0.1) {
    const level = options.hedgingLevel
    modifierSections.push(
      level > 0.5
        ? "# Hedging\nYou're deeply uncertain. Qualify everything. Use hedging language: 'maybe', 'I think', 'I'm not sure but'. Avoid definitive statements."
        : "# Hedging\nYou feel some uncertainty. Occasionally hedge your statements. Use softeners like 'perhaps' or 'it seems'."
    )
  }

  return [
    identityPrompt,
    personalityPrompt,
    RHYTHM_PROMPT,
    buildActionsPrompt(availableEvents, ALTERED_EVENT_TYPES, {
      hasNewCommits: options.hasNewCommits
    }),
    COMMUNICATION_PROMPT,
    PACING_PROMPT,
    PHENOMENOLOGICAL_PROMPT,
    DRIVE_AWARENESS_PROMPT,
    ...modifierSections,
    contextSections
  ]
    .filter(Boolean)
    .join("\n\n")
}
