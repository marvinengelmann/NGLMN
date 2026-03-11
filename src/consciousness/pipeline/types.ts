import type { ActiveAlteredState } from "@/affect/altered/types.ts"
import type { InnerDialog } from "@/cognition/polyphony/types.ts"
import type { IdiolectState } from "@/expression/communication/idiolect.ts"
import type { ConversationSlot } from "@/expression/communication/types.ts"
import type { DreamAfterglow, DreamState } from "@/expression/dream/types.ts"
import type { CodeProposal, EvolutionCycleResult } from "@/governance/evolution/types.ts"
import type { EmotionHistorySelect, EvolutionLogSelect, GoalSelect } from "@/infra/db/schema.ts"
import type { AnimaResult } from "@/infra/lib/result.ts"
import type { EpisodeMetadata, RelationalMemoryState } from "@/memory/types.ts"
import type { DistortedMemory } from "@/perception/distortion/types.ts"
import type { AttachmentStyle, RelationshipPhase } from "@/relational/attachment/types.ts"
import type { ActionType } from "@/relational/trust/types.ts"
import type { GrowthArc, NarrativeEntry, SelfConcept } from "@/self/psyche/types.ts"
import type { FeelingResult, SenseResult, TickSummary } from "../types.ts"

export interface TickState {
  tickId: string
  startTime: number
  timestamp: string
  sense: SenseResult
  feel: FeelingResult
  preloaded: PreloadedState
}

export interface PreloadedState {
  lastTick: TickSummary | null
  conversationBuffer: ConversationSlot[]
  emotionHistory: EmotionHistorySelect[]
  episodes: DistortedMemory[]
  relationships: Array<{
    id: string
    score: number
    metadata: EpisodeMetadata | undefined
    data: string | undefined
  }>
  knowledge: AnimaResult<import("@/infra/db/schema.ts").SemanticMemorySelect[]>
  operatorLanguage: string
  goals: GoalSelect[]
  trustLevels: Array<{
    actionType: ActionType
    totalAttempts: number
    successfulAttempts: number
    weightedExperience: number
  }>
  evolutionHistory: EvolutionLogSelect[]
  evolutionOutcome: EvolutionCycleResult | null
  pendingProposal: CodeProposal | null
  dreamState: DreamState
  dreamLastRun: string | null
  dreamInsights: string[] | null
  reflectionLastAt: string | null
  selfConcept: SelfConcept
  attachmentStyle: AttachmentStyle
  lastInnerDialog: InnerDialog | null
  relationshipPhase: RelationshipPhase
  existentialQuestions: string[]
  identityStatements: string[]
  growthArcs: GrowthArc[]
  recentNarratives: NarrativeEntry[]
  dreamAfterglow: DreamAfterglow | null
  alteredState: ActiveAlteredState | null
  idiolectState: IdiolectState
  relationalMemoryState: RelationalMemoryState
  recentTickDurations: number[]
  consecutiveIdleTicks: number
  recentCounterfactuals: string[]
  conversationPatterns: string[]
  recurringUnresolved: string[]
}
