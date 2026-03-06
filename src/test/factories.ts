import type { AttachmentDynamics, AttachmentStyle } from "@/attachment/types.ts"
import { DEFAULT_ATTACHMENT } from "@/attachment/types.ts"
import type { InstinctImpression } from "@/cognition/types.ts"
import type { ConversationClimate, ConversationMessage, ConversationSlot } from "@/communication/types.ts"
import type { DeceptionState, HiddenDriver } from "@/deception/types.ts"
import { DEFAULT_DECEPTION_STATE } from "@/deception/types.ts"
import type { DissonanceEvent, DissonanceState } from "@/dissonance/types.ts"
import type { DreamAfterglow } from "@/dream/types.ts"
import type { AfterglowEntry, EmotionalMomentum, EmotionalState, MoodContext } from "@/emotion/types.ts"
import { DEFAULT_EMOTIONAL_MOMENTUM, DEFAULT_EMOTIONAL_STATE } from "@/emotion/types.ts"
import type { HealthCheckResult } from "@/health/types.ts"
import type { PendingMessage } from "@/integrations/types.ts"
import type { CorrectionPattern, MoodUncertainty, OperatorModel, OperatorProfile } from "@/mind/types.ts"
import { DEFAULT_OPERATOR_MODEL, DEFAULT_OPERATOR_PROFILE } from "@/mind/types.ts"
import type { PerceptionSummary } from "@/perception/types.ts"
import type { ExistentialQuestion, GrowthArc, SelfConcept } from "@/psyche/types.ts"
import { DEFAULT_SELF_CONCEPT } from "@/psyche/types.ts"
import type { GuardianResult } from "@/security/types.ts"
import type { SomaticState } from "@/soma/types.ts"
import { DEFAULT_SOMATIC_STATE } from "@/soma/types.ts"
import type { TrustEvent } from "@/trust/types.ts"
import type { VulnerabilityState, VulnerableMessageStyle } from "@/vulnerability/types.ts"
import { DEFAULT_VULNERABLE_MESSAGE_STYLE } from "@/vulnerability/types.ts"

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
