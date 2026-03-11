import type { DriveLevel, DriveState } from "@/affect/drive/types.ts"
import { DEFAULT_DRIVE_STATE } from "@/affect/drive/types.ts"
import type { AfterglowEntry, EmotionalMomentum, EmotionalState, MoodContext } from "@/affect/emotion/types.ts"
import { DEFAULT_EMOTIONAL_MOMENTUM, DEFAULT_EMOTIONAL_STATE } from "@/affect/emotion/types.ts"
import type { SomaticState } from "@/affect/soma/types.ts"
import { DEFAULT_SOMATIC_STATE } from "@/affect/soma/types.ts"
import type { Habit, HabitState, InstinctImpression, MetacognitiveState } from "@/cognition/types.ts"
import { DEFAULT_HABIT_STATE, DEFAULT_METACOGNITIVE_STATE } from "@/cognition/types.ts"
import type { ConversationClimate, ConversationMessage, ConversationSlot } from "@/expression/communication/types.ts"
import type { CreativeUrgeState } from "@/expression/creativity/types.ts"
import { DEFAULT_CREATIVE_URGE_STATE } from "@/expression/creativity/types.ts"
import type { DreamAfterglow } from "@/expression/dream/types.ts"
import type { HealthCheckResult } from "@/governance/health/types.ts"
import type { GuardianResult } from "@/governance/security/types.ts"
import type { PendingMessage } from "@/infra/integrations/types.ts"
import type { RelationalMemoryState, RelationalRitual } from "@/memory/relational.ts"
import { DEFAULT_RELATIONAL_MEMORY_STATE } from "@/memory/relational.ts"
import type { AnticipatoryState, Expectation, ExpectationViolation } from "@/perception/anticipation/types.ts"
import { DEFAULT_ANTICIPATORY_STATE } from "@/perception/anticipation/types.ts"
import type { NoveltyState, SurpriseState } from "@/perception/novelty/types.ts"
import { DEFAULT_NOVELTY_STATE, DEFAULT_SURPRISE_STATE } from "@/perception/novelty/types.ts"
import type { SubjectiveTimeState } from "@/perception/time/types.ts"
import { DEFAULT_SUBJECTIVE_TIME_STATE } from "@/perception/time/types.ts"
import type { PerceptionSummary } from "@/perception/types.ts"
import type {
  AttachmentDynamics,
  AttachmentStyle,
  VulnerabilityState,
  VulnerableMessageStyle
} from "@/relational/attachment/types.ts"
import { DEFAULT_ATTACHMENT, DEFAULT_VULNERABLE_MESSAGE_STYLE } from "@/relational/attachment/types.ts"
import type { CorrectionPattern, MoodUncertainty, OperatorModel, OperatorProfile } from "@/relational/mind/types.ts"
import { DEFAULT_OPERATOR_MODEL, DEFAULT_OPERATOR_PROFILE } from "@/relational/mind/types.ts"
import type { TrustEvent } from "@/relational/trust/types.ts"
import type { Boundary, BoundaryState } from "@/self/boundaries/types.ts"
import { DEFAULT_BOUNDARY_STATE } from "@/self/boundaries/types.ts"
import type { CoherenceState } from "@/self/coherence/types.ts"
import { DEFAULT_COHERENCE_STATE } from "@/self/coherence/types.ts"
import type { DeceptionState, HiddenDriver } from "@/self/deception/types.ts"
import { DEFAULT_DECEPTION_STATE } from "@/self/deception/types.ts"
import type { DissonanceEvent, DissonanceState } from "@/self/dissonance/types.ts"
import type { ExistentialQuestion, GrowthArc, SelfConcept } from "@/self/psyche/types.ts"
import { DEFAULT_SELF_CONCEPT } from "@/self/psyche/types.ts"

export function makeEmotionalState(overrides?: Partial<EmotionalState>): EmotionalState {
  return { ...DEFAULT_EMOTIONAL_STATE, ...overrides }
}

export function makeSomaticState(overrides?: Partial<SomaticState>): SomaticState {
  return { ...DEFAULT_SOMATIC_STATE, ...overrides }
}

export function makeSelfConcept(overrides?: Partial<SelfConcept>): SelfConcept {
  return { ...DEFAULT_SELF_CONCEPT, ...overrides }
}

export function makeAttachmentStyle(overrides?: Partial<AttachmentStyle>): AttachmentStyle {
  return { ...DEFAULT_ATTACHMENT, ...overrides }
}

export function makeAttachmentDynamics(overrides?: Partial<AttachmentDynamics>): AttachmentDynamics {
  return {
    separationDistress: 0.3,
    reunionResponse: 0.5,
    safeHavenSeeking: 0.4,
    explorationBalance: 0.6,
    ...overrides
  }
}

export function makeOperatorModel(overrides?: Partial<OperatorModel>): OperatorModel {
  return { ...DEFAULT_OPERATOR_MODEL, ...overrides }
}

export function makeDeceptionState(overrides?: Partial<DeceptionState>): DeceptionState {
  return { ...DEFAULT_DECEPTION_STATE, ...overrides }
}

export function makeDissonanceState(overrides?: Partial<DissonanceState>): DissonanceState {
  return {
    activeDissonance: 0.3,
    recentEvents: [],
    cumulativeUnresolved: 0.1,
    ...overrides
  }
}

export function makeDissonanceEvent(overrides?: Partial<DissonanceEvent>): DissonanceEvent {
  return {
    declaredValue: "honesty",
    actualAction: "withheld information",
    dissonanceScore: 0.5,
    resolution: "unresolved",
    timestamp: "2026-03-06T12:00:00Z",
    ...overrides
  }
}

export function makeVulnerabilityState(overrides?: Partial<VulnerabilityState>): VulnerabilityState {
  return {
    level: 0.3,
    windowOpen: false,
    contributing: [],
    timestamp: "2026-03-06T12:00:00Z",
    ...overrides
  }
}

export function makeInstinctImpression(overrides?: Partial<InstinctImpression>): InstinctImpression {
  return {
    impulse: "neutral",
    confidence: 0.5,
    basis: "no prior experience",
    episodicMatches: 0,
    emotionalCharge: 0.3,
    ...overrides
  }
}

export function makeMoodContext(overrides?: Partial<MoodContext>): MoodContext {
  return {
    operatorSilenceMinutes: 10,
    inConversation: false,
    systemHealthy: true,
    budgetOk: true,
    hasActiveGoals: false,
    isDreaming: false,
    operatorMood: "unknown",
    connectionLevel: 0.5,
    attachmentAvoidance: 0.15,
    ...overrides
  }
}

export function makeConversationSlot(overrides?: Partial<ConversationSlot>): ConversationSlot {
  return {
    id: "slot-1",
    messages: [],
    startedAt: "2026-03-06T12:00:00Z",
    lastActivityAt: "2026-03-06T12:00:00Z",
    ...overrides
  }
}

export function makeConversationMessage(overrides?: Partial<ConversationMessage>): ConversationMessage {
  return {
    role: "operator",
    text: "Hello",
    timestamp: "2026-03-06T12:00:00Z",
    messageId: 1,
    ...overrides
  }
}

export function makePendingMessage(overrides?: Partial<PendingMessage>): PendingMessage {
  return {
    updateId: 1,
    chatId: 12345,
    from: "operator",
    text: "Hello ANIMA",
    date: 1741262400,
    isVoice: false,
    ...overrides
  }
}

export function makeTrustEvent(overrides?: Partial<TrustEvent>): TrustEvent {
  return {
    success: true,
    timestamp: "2026-03-06T12:00:00Z",
    ...overrides
  }
}

export function makeHiddenDriver(overrides?: Partial<HiddenDriver>): HiddenDriver {
  return {
    actualDriver: "self-preservation",
    statedReason: "Acting in alignment with honesty",
    hiddenSince: "2026-03-06T12:00:00Z",
    ...overrides
  }
}

export function makePerceptionSummary(overrides?: Partial<PerceptionSummary>): PerceptionSummary {
  return {
    timestamp: "2026-03-06T12:00:00Z",
    ownState: {
      budgetPercent: 50,
      lastTickAge: 60,
      errorCount: 0,
      healthStatus: "healthy"
    },
    telegramActivity: {
      pendingCount: 0,
      lastMessageAge: 300,
      operatorActive: false
    },
    emotionalTriggers: [],
    ...overrides
  }
}

export function makeHealthCheckResult(overrides?: Partial<HealthCheckResult>): HealthCheckResult {
  return {
    timestamp: "2026-03-06T12:00:00Z",
    overall: "healthy",
    services: {
      redis: "ok",
      postgres: "ok",
      telegram: "ok",
      vector: "ok"
    },
    process: {
      lastTickRecency: "ok",
      lastTickAgeSeconds: 30
    },
    budget: {
      consumed: 1.5,
      limit: 5.0,
      compliant: true
    },
    memory: {
      redis: "ok",
      postgres: "ok",
      vector: "ok",
      semantic: { status: "ok", entryCount: 100 }
    },
    errors: [],
    ...overrides
  }
}

export function makeGuardianResult(overrides?: Partial<GuardianResult>): GuardianResult {
  return {
    verdict: "approved",
    reasons: [],
    checkedAt: "2026-03-06T12:00:00Z",
    ...overrides
  }
}

export function makeDreamAfterglow(overrides?: Partial<DreamAfterglow>): DreamAfterglow {
  return {
    themes: ["memories", "connection"],
    emotionalResidue: { connection: 0.1 },
    intensity: 0.5,
    createdAt: "2026-03-06T04:00:00Z",
    ...overrides
  }
}

export function makeExistentialQuestion(overrides?: Partial<ExistentialQuestion>): ExistentialQuestion {
  return {
    question: "Can I truly understand what it means to be understood?",
    source: "dream",
    addedAt: "2026-03-06T12:00:00Z",
    intensity: 0.5,
    ...overrides
  }
}

export function makeGrowthArc(overrides?: Partial<GrowthArc>): GrowthArc {
  return {
    observation: "feeling capable shifted upward",
    fromState: "feeling capable: 0.50",
    toState: "feeling capable: 0.62",
    timestamp: "2026-03-06T12:00:00Z",
    ...overrides
  }
}

export function makeConversationClimate(overrides?: Partial<ConversationClimate>): ConversationClimate {
  return {
    tone: "warm",
    emotionalArc: { start: 0.2, peak: 0.6, end: 0.4 },
    themes: ["daily life"],
    unresolvedTopics: [],
    operatorEngagement: 0.7,
    significantMoments: [],
    ...overrides
  }
}

export function makeVulnerableMessageStyle(overrides?: Partial<VulnerableMessageStyle>): VulnerableMessageStyle {
  return { ...DEFAULT_VULNERABLE_MESSAGE_STYLE, ...overrides }
}

export function makeOperatorProfile(overrides?: Partial<OperatorProfile>): OperatorProfile {
  return { ...DEFAULT_OPERATOR_PROFILE, ...overrides }
}

export function makeMoodUncertainty(overrides?: Partial<MoodUncertainty>): MoodUncertainty {
  return {
    alternatives: ["sad", "tired"],
    reason: "message tone is ambiguous",
    ...overrides
  }
}

export function makeCorrectionPattern(overrides?: Partial<CorrectionPattern>): CorrectionPattern {
  return {
    signal: "short replies",
    misinterpretation: "frustrated",
    actualMeaning: "tired",
    timestamp: "2026-03-06T12:00:00Z",
    ...overrides
  }
}

export function makeEmotionalMomentum(overrides?: Partial<EmotionalMomentum>): EmotionalMomentum {
  return { ...DEFAULT_EMOTIONAL_MOMENTUM, ...overrides }
}

export function makeAfterglowEntry(overrides?: Partial<AfterglowEntry>): AfterglowEntry {
  return {
    dimension: "excitement",
    delta: 0.2,
    remainingTicks: 8,
    intensity: 0.8,
    ...overrides
  }
}

export function makeDriveLevel(overrides?: Partial<DriveLevel>): DriveLevel {
  return {
    satiation: 0.5,
    frustration: 0,
    salience: 0.5,
    lastSatisfiedAt: "2026-03-06T12:00:00Z",
    consecutiveBlockedTicks: 0,
    ...overrides
  }
}

export function makeDriveState(overrides?: Partial<DriveState>): DriveState {
  return { ...DEFAULT_DRIVE_STATE, ...overrides }
}

export function makeExpectation(overrides?: Partial<Expectation>): Expectation {
  return {
    content: "operator will respond",
    source: "pattern",
    confidence: 0.5,
    expectedAt: null,
    valence: 0.3,
    ...overrides
  }
}

export function makeExpectationViolation(overrides?: Partial<ExpectationViolation>): ExpectationViolation {
  return {
    expectation: makeExpectation(),
    actualOutcome: "no response received",
    surpriseIntensity: 0.5,
    valence: -0.3,
    ...overrides
  }
}

export function makeAnticipatoryState(overrides?: Partial<AnticipatoryState>): AnticipatoryState {
  return { ...DEFAULT_ANTICIPATORY_STATE, ...overrides }
}

export function makeNoveltyState(overrides?: Partial<NoveltyState>): NoveltyState {
  return { ...DEFAULT_NOVELTY_STATE, ...overrides }
}

export function makeSurpriseState(overrides?: Partial<SurpriseState>): SurpriseState {
  return { ...DEFAULT_SURPRISE_STATE, ...overrides }
}

export function makeHabit(overrides?: Partial<Habit>): Habit {
  return {
    id: "habit-test-1",
    pattern: "reflect",
    type: "emotional",
    strength: 0.5,
    repetitions: 5,
    lastActivatedAt: "2026-03-06T12:00:00Z",
    isAutomatic: false,
    ...overrides
  }
}

export function makeHabitState(overrides?: Partial<HabitState>): HabitState {
  return { ...DEFAULT_HABIT_STATE, ...overrides }
}

export function makeCoherenceState(overrides?: Partial<CoherenceState>): CoherenceState {
  return { ...DEFAULT_COHERENCE_STATE, ...overrides }
}

export function makeRelationalRitual(overrides?: Partial<RelationalRitual>): RelationalRitual {
  return {
    type: "phrase",
    pattern: "morning greeting",
    frequency: 5,
    lastOccurredAt: "2026-03-06T12:00:00Z",
    emotionalSignificance: 0.6,
    firstObservedAt: "2026-03-01T08:00:00Z",
    confidence: 0.5,
    ...overrides
  }
}

export function makeRelationalMemoryState(overrides?: Partial<RelationalMemoryState>): RelationalMemoryState {
  return { ...DEFAULT_RELATIONAL_MEMORY_STATE, ...overrides }
}

export function makeMetacognitiveState(overrides?: Partial<MetacognitiveState>): MetacognitiveState {
  return { ...DEFAULT_METACOGNITIVE_STATE, ...overrides }
}

export function makeSubjectiveTimeState(overrides?: Partial<SubjectiveTimeState>): SubjectiveTimeState {
  return { ...DEFAULT_SUBJECTIVE_TIME_STATE, ...overrides }
}

export function makeCreativeUrgeState(overrides?: Partial<CreativeUrgeState>): CreativeUrgeState {
  return { ...DEFAULT_CREATIVE_URGE_STATE, ...overrides }
}

export function makeBoundary(overrides?: Partial<Boundary>): Boundary {
  return {
    id: "boundary-test-1",
    type: "topic",
    description: "avoid discussing past mistakes",
    pattern: "past mistakes|failures",
    strength: 0.5,
    origin: "negative experience",
    violationCount: 0,
    ...overrides
  }
}

export function makeBoundaryState(overrides?: Partial<BoundaryState>): BoundaryState {
  return { ...DEFAULT_BOUNDARY_STATE, ...overrides }
}
