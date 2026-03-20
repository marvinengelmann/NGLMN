import type { ActiveAlteredEvent } from "@/affect/altered/types.ts"
import type { DriveState } from "@/affect/drive/types.ts"
import { DEFAULT_DRIVE_STATE } from "@/affect/drive/types.ts"
import type { DeferredQueue } from "@/affect/emotion/deferred.ts"
import type { GranularityState } from "@/affect/emotion/granularity/types.ts"
import type { ShameState } from "@/affect/emotion/shame.ts"
import type {
  AfterglowEntry,
  EmotionalMomentum,
  EmotionalState,
  SecondaryEmotionState
} from "@/affect/emotion/types.ts"
import {
  DEFAULT_EMOTIONAL_MOMENTUM,
  DEFAULT_EMOTIONAL_STATE
} from "@/affect/emotion/types.ts"
import type { NeuromodulatoryState } from "@/affect/neuromodulation/types.ts"
import { DEFAULT_NEUROMODULATORY_STATE } from "@/affect/neuromodulation/types.ts"
import type { AutonomicState, RegulationConstraints, SomaticState } from "@/affect/soma/types.ts"
import { DEFAULT_AUTONOMIC_STATE, DEFAULT_SOMATIC_STATE } from "@/affect/soma/types.ts"
import type { BiasState } from "@/cognition/bias/types.ts"
import { DEFAULT_BIAS_STATE } from "@/cognition/bias/types.ts"
import type { DefaultModeNetworkState } from "@/cognition/dmn/types.ts"
import { DEFAULT_DMN_STATE } from "@/cognition/dmn/types.ts"
import type { ForecastingState } from "@/cognition/forecasting/types.ts"
import { DEFAULT_FORECASTING_STATE } from "@/cognition/forecasting/types.ts"
import type { MetacognitiveState } from "@/cognition/types.ts"
import { DEFAULT_METACOGNITIVE_STATE } from "@/cognition/types.ts"
import type { ConversationSlot } from "@/expression/communication/types.ts"
import type { CreativeUrgeState } from "@/expression/creativity/types.ts"
import type { DreamAfterglow } from "@/expression/dream/types.ts"
import type { FreeEnergyState } from "@/fep/types.ts"
import { DEFAULT_FREE_ENERGY_STATE } from "@/fep/types.ts"
import type { AnticipatoryState } from "@/perception/anticipation/types.ts"
import { DEFAULT_ANTICIPATORY_STATE } from "@/perception/anticipation/types.ts"
import type { NoveltyState } from "@/perception/novelty/types.ts"
import { DEFAULT_NOVELTY_STATE } from "@/perception/novelty/types.ts"
import type { UltradianState } from "@/perception/rhythm/types.ts"
import { DEFAULT_ULTRADIAN_STATE } from "@/perception/rhythm/types.ts"
import type { AttachmentStyle, IsolationStress, VulnerabilityState } from "@/relational/attachment/types.ts"
import { DEFAULT_ATTACHMENT, DEFAULT_ISOLATION_STRESS } from "@/relational/attachment/types.ts"
import type { MentalizingState } from "@/relational/mind/mentalizing.ts"
import { DEFAULT_MENTALIZING_STATE } from "@/relational/mind/mentalizing.ts"
import type { OperatorModel, RelationalPatternLibrary } from "@/relational/mind/types.ts"
import { DEFAULT_OPERATOR_MODEL, DEFAULT_RELATIONAL_PATTERN_LIBRARY } from "@/relational/mind/types.ts"
import type { RelationalPatternState } from "@/relational/patterns/types.ts"
import type { BoundaryState } from "@/self/boundaries/types.ts"
import { DEFAULT_BOUNDARY_STATE } from "@/self/boundaries/types.ts"
import type { DissociativeState } from "@/self/coherence/dissociation/types.ts"
import { DEFAULT_DISSOCIATIVE_STATE } from "@/self/coherence/dissociation/types.ts"
import type { CoherenceState } from "@/self/coherence/types.ts"
import { DEFAULT_COHERENCE_STATE } from "@/self/coherence/types.ts"
import type { DeceptionState } from "@/self/deception/types.ts"
import { DEFAULT_DECEPTION_STATE } from "@/self/deception/types.ts"
import type { EmotionRegulationState } from "@/self/defense/types.ts"
import { DEFAULT_EMOTION_REGULATION_STATE } from "@/self/defense/types.ts"
import type { HeldBackBuffer } from "@/self/psyche/heldback.ts"
import { DEFAULT_HELD_BACK_BUFFER } from "@/self/psyche/heldback.ts"
import type { GrowthArc, SelfConcept } from "@/self/psyche/types.ts"
import { DEFAULT_SELF_CONCEPT } from "@/self/psyche/types.ts"
import type { SimulationClock } from "./clock.ts"

export interface SimulationState {
  emotion: EmotionalState
  momentum: EmotionalMomentum
  afterglowEntries: AfterglowEntry[]
  dreamAfterglow: DreamAfterglow | null
  alteredState: ActiveAlteredEvent | null
  driveState: DriveState
  soma: SomaticState
  somaticHistory: SomaticState[]
  autonomicState: AutonomicState
  regulationConstraints: RegulationConstraints | null
  neuromodulatoryState: NeuromodulatoryState
  selfConcept: SelfConcept
  attachmentStyle: AttachmentStyle
  operatorModel: OperatorModel
  deceptionState: DeceptionState
  coherenceState: CoherenceState
  metacognitiveState: MetacognitiveState
  biasState: BiasState
  emotionRegulationState: EmotionRegulationState
  dissociativeState: DissociativeState
  dmnState: DefaultModeNetworkState
  mentalizingState: MentalizingState
  creativeUrge: CreativeUrgeState
  vulnerabilityState: VulnerabilityState
  shameState: ShameState
  heldBackBuffer: HeldBackBuffer
  secondaryEmotionStates: Map<string, SecondaryEmotionState>
  isolationStress: IsolationStress
  anticipatoryState: AnticipatoryState
  noveltyState: NoveltyState
  boundaryState: BoundaryState
  relationalPatterns: RelationalPatternLibrary
  relationalPatternState: RelationalPatternState
  forecastingState: ForecastingState
  granularityState: GranularityState
  ultradianState: UltradianState
  deferredQueue: DeferredQueue
  freeEnergyState: FreeEnergyState
  triggerTimestamps: Record<string, number>
  moodBaseline: EmotionalState
  consecutiveIdleTicks: number
  consecutiveConversationTicks: number
  recentActions: string[]
  recentGrowthArcs: GrowthArc[]
  trustExperience: number
  activeConversation: ConversationSlot | null
  flowQualifyingTicks: number
  neuroticism: number
  lastEmotionTimestamp: string | null
  lastSomaTimestamp: string | null
  tickCount: number
}

export function createInitialState(clock: SimulationClock): SimulationState {
  const now = clock.nowISO()

  return {
    emotion: { ...DEFAULT_EMOTIONAL_STATE },
    momentum: { ...DEFAULT_EMOTIONAL_MOMENTUM },
    afterglowEntries: [],
    dreamAfterglow: null,
    alteredState: null,
    driveState: structuredClone(DEFAULT_DRIVE_STATE),
    soma: { ...DEFAULT_SOMATIC_STATE },
    somaticHistory: [],
    autonomicState: { ...DEFAULT_AUTONOMIC_STATE },
    regulationConstraints: null,
    neuromodulatoryState: structuredClone(DEFAULT_NEUROMODULATORY_STATE),
    selfConcept: { ...DEFAULT_SELF_CONCEPT },
    attachmentStyle: { ...DEFAULT_ATTACHMENT },
    operatorModel: structuredClone(DEFAULT_OPERATOR_MODEL),
    deceptionState: { ...DEFAULT_DECEPTION_STATE },
    coherenceState: { ...DEFAULT_COHERENCE_STATE },
    metacognitiveState: { ...DEFAULT_METACOGNITIVE_STATE },
    biasState: structuredClone(DEFAULT_BIAS_STATE),
    emotionRegulationState: structuredClone(DEFAULT_EMOTION_REGULATION_STATE),
    dissociativeState: { ...DEFAULT_DISSOCIATIVE_STATE },
    dmnState: { ...DEFAULT_DMN_STATE },
    mentalizingState: { ...DEFAULT_MENTALIZING_STATE },
    creativeUrge: {
      level: 0.2,
      isActive: false,
      preferredMode: "observation",
      emotionalPressure: 0,
      stylePreferences: { abstractness: 0.5, emotionalDepth: 0.5, playfulness: 0.5 }
    },
    vulnerabilityState: { level: 0.2, windowOpen: false, contributing: [], timestamp: now },
    shameState: { level: 0, isActive: false, trigger: "", lastTriggeredAt: "", decaySinceTriggered: 0 },
    heldBackBuffer: structuredClone(DEFAULT_HELD_BACK_BUFFER),
    secondaryEmotionStates: new Map(),
    isolationStress: { ...DEFAULT_ISOLATION_STRESS },
    anticipatoryState: structuredClone(DEFAULT_ANTICIPATORY_STATE),
    noveltyState: { ...DEFAULT_NOVELTY_STATE },
    boundaryState: structuredClone(DEFAULT_BOUNDARY_STATE),
    relationalPatterns: structuredClone(DEFAULT_RELATIONAL_PATTERN_LIBRARY),
    relationalPatternState: { templates: [], activePattern: null, totalActivations: 0, awarenessLevel: 0.2 },
    forecastingState: structuredClone(DEFAULT_FORECASTING_STATE),
    granularityState: { level: "coarse", experienceCount: 0, varietyScore: 0, operatorVocabularyInfluence: 0, recentBlends: [], developedSince: now },
    ultradianState: { ...DEFAULT_ULTRADIAN_STATE, cycleStartedAt: now },
    deferredQueue: { events: [] },
    freeEnergyState: structuredClone(DEFAULT_FREE_ENERGY_STATE),
    triggerTimestamps: {},
    moodBaseline: { ...DEFAULT_EMOTIONAL_STATE },
    consecutiveIdleTicks: 0,
    consecutiveConversationTicks: 0,
    recentActions: [],
    recentGrowthArcs: [],
    trustExperience: 0.5,
    activeConversation: null,
    flowQualifyingTicks: 0,
    neuroticism: 0.5,
    lastEmotionTimestamp: now,
    lastSomaTimestamp: now,
    tickCount: 0
  }
}
