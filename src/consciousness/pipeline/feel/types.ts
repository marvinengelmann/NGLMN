import type { ActiveAlteredEvent } from "@/affect/altered/types.ts"
import type { DriveState } from "@/affect/drive/types.ts"
import type { DeferredEmotionalEvent, DeferredQueue } from "@/affect/emotion/deferred.ts"
import type { GranularityState } from "@/affect/emotion/granularity/types.ts"
import type { ShameState } from "@/affect/emotion/shame.ts"
import type {
  AfterglowEntry,
  AppraisalResult,
  EmotionalMomentum,
  EmotionalState,
  EmotionConstructionResult,
  EmotionTrigger,
  EmotionUpdateEvent,
  SecondaryEmotionState
} from "@/affect/emotion/types.ts"
import type { NeuromodulatoryState } from "@/affect/neuromodulation/types.ts"
import type {
  AutonomicState,
  BodyRegionMap,
  InteroceptivePrediction,
  RegulationConstraints,
  SomaticState
} from "@/affect/soma/types.ts"
import type { BiasState } from "@/cognition/bias/types.ts"
import type { DefaultModeNetworkState } from "@/cognition/dmn/types.ts"
import type { ForecastingState } from "@/cognition/forecasting/types.ts"
import type { AssociationActivation } from "@/cognition/learning/association/types.ts"
import type { AttentionState, InstinctImpression, MetacognitiveState } from "@/cognition/types.ts"
import type { CommunicationRegister, ConversationSlot } from "@/expression/communication/types.ts"
import type { CreativeUrgeState } from "@/expression/creativity/types.ts"
import type { DreamAfterglow } from "@/expression/dream/types.ts"
import type { SemanticMemorySelect } from "@/infra/db/schema.ts"
import type { AnticipatoryState } from "@/perception/anticipation/types.ts"
import type { NoveltyState } from "@/perception/novelty/types.ts"
import type { ProustFlashback } from "@/perception/proust.ts"
import type { UltradianState } from "@/perception/rhythm/types.ts"
import type { SubjectiveTimeState } from "@/perception/time/types.ts"
import type {
  AttachmentDynamics,
  AttachmentStyle,
  IsolationStress,
  VulnerabilityState,
  VulnerableMessageStyle
} from "@/relational/attachment/types.ts"
import type { MentalizingState } from "@/relational/mind/mentalizing.ts"
import type { OperatorModel, RelationalPatternLibrary } from "@/relational/mind/types.ts"
import type { PatternActivationEvent, RelationalPatternState } from "@/relational/patterns/types.ts"
import type { BoundaryState, BoundaryViolation } from "@/self/boundaries/types.ts"
import type { DissociativeState } from "@/self/coherence/dissociation/types.ts"
import type { CoherenceState } from "@/self/coherence/types.ts"
import type { DeceptionState } from "@/self/deception/types.ts"
import type { ConversionSignal, EmotionRegulationState } from "@/self/defense/types.ts"
import type { DissonanceState } from "@/self/dissonance/types.ts"
import type { HeldBackBuffer } from "@/self/psyche/heldback.ts"
import type { GrowthArc, SelfConcept } from "@/self/psyche/types.ts"

export interface FeelPrefetch {
  dnaBaseline: EmotionalState | null
  currentEmotion: EmotionalState
  previousMomentum: EmotionalMomentum
  existingAfterglow: AfterglowEntry[]
  dreamAfterglow: DreamAfterglow | null
  alteredState: ActiveAlteredEvent | null
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
  heldBackBuffer: HeldBackBuffer
  previousSecondaryEmotionStates: Map<string, SecondaryEmotionState>
  selfInsights: SemanticMemorySelect[]
  relationalPatterns: RelationalPatternLibrary
  deferredQueue: DeferredQueue
  previousAutonomicState: AutonomicState
  interoceptiveAccuracy: number
  recentSomaHistory: SomaticState[]
  previousRegionalState: BodyRegionMap
  sensitizationProfile: BodyRegionMap
  vulnerabilityProfile: BodyRegionMap
  inflammationLevel: number
  previousConversionSignal: ConversionSignal
  previousNeuromodulatoryState: NeuromodulatoryState
  previousIsolationStress: IsolationStress
  previousBiasState: BiasState
  previousEmotionRegulationState: EmotionRegulationState
  previousGranularity: GranularityState
  previousForecastingState: ForecastingState
  previousUltradian: UltradianState
  previousRelationalPatternState: RelationalPatternState
  previousDissociativeState: DissociativeState
  flowQualifyingTicks: number
  neuroticism: number
  previousDMNState: DefaultModeNetworkState
  previousMentalizingState: MentalizingState
}

export interface EmotionChainResult {
  emotion: EmotionalState
  driveState: DriveState
  soma: SomaticState
  alteredState: ActiveAlteredEvent | null
  episodicHits: Array<{ data?: string }>
  momentum: EmotionalMomentum
  afterglowEntries: AfterglowEntry[]
  emotionTimestamp: string
  triggerTimestamps: Record<string, string>
  dreamAfterglowDecayed: DreamAfterglow | null
  alteredStateCleared: boolean
  emotionTrigger: EmotionTrigger
  proustFlashback: ProustFlashback | null
  maturedDeferredEvents: DeferredEmotionalEvent[]
  updatedDeferredQueue: DeferredQueue
  autonomicState: AutonomicState
  regulationConstraints: RegulationConstraints
  interoceptivePrediction: InteroceptivePrediction | null
  appraisalResults: AppraisalResult[]
  neuromodulatoryState: NeuromodulatoryState
  constructionResults: EmotionConstructionResult[]
  regionalActivation: BodyRegionMap
  sensitizationProfile: BodyRegionMap
  vulnerabilityProfile: BodyRegionMap
  inflammationLevel: number
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
  newBoundaryViolations: BoundaryViolation[]
  boundaryEmotionEvents: EmotionUpdateEvent[]
  isolationStress: IsolationStress
  implicitAssociations: AssociationActivation[]
  patternModulation: Record<string, number>
  patternActivationEvent: PatternActivationEvent | null
  mentalizingState: MentalizingState
}

export interface VulnerabilityChainResult {
  vulnerability: VulnerabilityState
  vulnerableMessageStyle: VulnerableMessageStyle
  shameState: ShameState
  heldBackBuffer: HeldBackBuffer
  selfDisclosureDepth: number
  suppressionDetected: boolean
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
  communicationSimplification: number
  hedgingLevel: number
  emotionRegulationState: EmotionRegulationState
  regulationExpressionModifiers: string | null
  biasState: BiasState
  microExpressionInstructions: string | null
  dissociativeState: DissociativeState
  granularityLevel: string
  dmnState: DefaultModeNetworkState
  conversionSignal: ConversionSignal
}
