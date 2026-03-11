import type { ActiveAlteredState } from "@/affect/altered/types.ts"
import type { DriveState } from "@/affect/drive/types.ts"
import type { ShameState } from "@/affect/emotion/shame.ts"
import type {
  AfterglowEntry,
  EmotionalMomentum,
  EmotionalState,
  EmotionTrigger,
  EmotionUpdateEvent,
  SecondaryEmotionState
} from "@/affect/emotion/types.ts"
import type { SomaticState } from "@/affect/soma/types.ts"
import type { AttentionState, InstinctImpression, MetacognitiveState } from "@/cognition/types.ts"
import type { CommunicationRegister, ConversationSlot } from "@/expression/communication/types.ts"
import type { CreativeUrgeState } from "@/expression/creativity/types.ts"
import type { DreamAfterglow } from "@/expression/dream/types.ts"
import type { AnticipatoryState } from "@/perception/anticipation/types.ts"
import type { NoveltyState } from "@/perception/novelty/types.ts"
import type { SubjectiveTimeState } from "@/perception/time/types.ts"
import type {
  AttachmentDynamics,
  AttachmentStyle,
  VulnerabilityState,
  VulnerableMessageStyle
} from "@/relational/attachment/types.ts"
import type { OperatorModel, RelationalPatternLibrary } from "@/relational/mind/types.ts"
import type { BoundaryState } from "@/self/boundaries/types.ts"
import type { CoherenceState } from "@/self/coherence/types.ts"
import type { DeceptionState } from "@/self/deception/types.ts"
import type { DissonanceState } from "@/self/dissonance/types.ts"
import type { HeldBackBuffer } from "@/self/psyche/heldback.ts"
import type { GrowthArc, SelfConcept } from "@/self/psyche/types.ts"

export interface FeelPrefetch {
  currentEmotion: EmotionalState
  previousMomentum: EmotionalMomentum
  existingAfterglow: AfterglowEntry[]
  dreamAfterglow: DreamAfterglow | null
  alteredState: ActiveAlteredState | null
  previousDriveState: DriveState
  consecutiveIdleTicks: number
  currentSoma: SomaticState
  lastSomaTimestamp: string | null
  selfConcept: SelfConcept
  attachmentStyle: AttachmentStyle
  trustExperience: number
  previousOperatorModel: OperatorModel
  deceptionState: DeceptionState
  activeConversation: ConversationSlot | null
  consecutiveConversationTicks: number
  previousShameState: ShameState
  previousAnticipation: AnticipatoryState
  previousBoundaryState: BoundaryState
  previousNovelty: NoveltyState
  previousCoherence: CoherenceState
  previousMetacognition: MetacognitiveState
  previousCreativeUrge: CreativeUrgeState
  vulnerabilityPrevLevel: number | null
  triggerTimestamps: Record<string, string>
  recentActions: string[]
  recentGrowthArcs: GrowthArc[]
}

export interface EmotionChainResult {
  emotion: EmotionalState
  driveState: DriveState
  soma: SomaticState
  alteredState: ActiveAlteredState | null
  episodicHits: Array<{ data?: string }>
  momentum: EmotionalMomentum
  afterglowEntries: AfterglowEntry[]
  emotionTimestamp: string
  triggerTimestamps: Record<string, string>
  dreamAfterglowDecayed: DreamAfterglow | null
  alteredStateCleared: boolean
  emotionTrigger: EmotionTrigger
}

export interface ParallelFanResult {
  instinct: InstinctImpression
  dissonance: DissonanceState
  operatorModel: OperatorModel
  operatorModelTrigger: string
  relationalPatterns: RelationalPatternLibrary | null
  attachmentDynamics: AttachmentDynamics
  anticipatoryState: AnticipatoryState
  noveltyState: NoveltyState
  boundaryState: BoundaryState
  boundaryEmotionEvents: EmotionUpdateEvent[]
}

export interface VulnerabilityChainResult {
  vulnerability: VulnerabilityState
  vulnerableMessageStyle: VulnerableMessageStyle
  shameState: ShameState
  heldBackBuffer: HeldBackBuffer
  selfDisclosureDepth: number
}

export interface SecondaryResult {
  emotion: EmotionalState
  secondaryEmotions: Record<string, unknown>
  secondaryEmotionStates: Map<string, SecondaryEmotionState>
  hasActiveSecondary: boolean
}

export interface FinalFanResult {
  subjectiveTime: SubjectiveTimeState
  creativeUrge: CreativeUrgeState
  deceptionState: DeceptionState
  register: CommunicationRegister
  attentionState: AttentionState
  coherenceState: CoherenceState
  metacognitiveState: MetacognitiveState
  dampedEmotion: EmotionalState
  selfConceptWithMomentum: SelfConcept
}
