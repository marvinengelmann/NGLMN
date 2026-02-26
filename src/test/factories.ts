import type { ConversationMessage, ConversationSlot } from "@/bridge/types.ts"
import type { BudgetState } from "@/core/budget.ts"
import type { ProactiveResult } from "@/core/phases/act.ts"
import type { TickSummary, TriageResult, WorkflowDefinition, WorkflowExecutionResult } from "@/core/types.ts"
import type { ConsolidationResult, ReflectionInput, ReflectionOutput } from "@/dream/types.ts"
import type { EmotionalState, EmotionUpdateEvent, MetricsSnapshot } from "@/emotion/types.ts"
import { DEFAULT_EMOTIONAL_STATE } from "@/emotion/types.ts"
import type { SandboxResult } from "@/integrations/e2b.ts"
import type { OperatorLocation } from "@/integrations/location.ts"
import type { PendingEmail, PendingMessage, WeatherData } from "@/integrations/types.ts"
import type { PerceptionSummary } from "@/perception/types.ts"
import { PERSONALITY_CENTER, type PersonalityDna, type PersonalityLayer } from "@/personality/types.ts"
import type { DriftReport, GuardianResult } from "@/security/types.ts"
import type { TrustAssessment } from "@/trust/types.ts"

export function makeTriageResult(overrides?: Partial<TriageResult>): TriageResult {
  return {
    decision: "simple",
    reason: "Test reason",
    confidence: 0.9,
    estimatedTokens: 100,
    ...overrides
  }
}

export function makePendingMessage(overrides?: Partial<PendingMessage>): PendingMessage {
  return {
    updateId: 1,
    chatId: 123,
    from: "operator",
    text: "Hello",
    date: Math.floor(Date.now() / 1000),
    messageId: 100,
    ...overrides
  }
}

export function makeConversationMessage(overrides?: Partial<ConversationMessage>): ConversationMessage {
  return {
    role: "operator",
    text: "Hello",
    timestamp: new Date().toISOString(),
    ...overrides
  }
}

export function makeConversationSlot(overrides?: Partial<ConversationSlot>): ConversationSlot {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    messages: [makeConversationMessage()],
    startedAt: now,
    lastActivityAt: now,
    ...overrides
  }
}

export function makeTickSummary(overrides?: Partial<TickSummary>): TickSummary {
  return {
    tickId: "tick-001",
    timestamp: new Date().toISOString(),
    triageDecision: "idle",
    triageReason: "No messages",
    messagesProcessed: 0,
    responseSent: false,
    durationMs: 150,
    ...overrides
  }
}

export function makeBudgetState(overrides?: Partial<BudgetState>): BudgetState {
  return {
    consumedToday: 2.0,
    dailyLimit: 8.0,
    remainingToday: 6.0,
    ...overrides
  }
}

export function makeGuardianResult(overrides?: Partial<GuardianResult>): GuardianResult {
  return {
    verdict: "approved",
    reasons: [],
    checkedAt: new Date().toISOString(),
    ...overrides
  }
}

export function makeDriftReport(overrides?: Partial<DriftReport>): DriftReport {
  return {
    signals: [],
    healthy: true,
    checkedAt: new Date().toISOString(),
    ...overrides
  }
}

export function makeEmotionalState(overrides?: Partial<EmotionalState>): EmotionalState {
  return {
    ...DEFAULT_EMOTIONAL_STATE,
    ...overrides
  }
}

export function makePersonalityLayer(overrides?: Partial<PersonalityLayer>): PersonalityLayer {
  return { ...PERSONALITY_CENTER, ...overrides }
}

export function makePersonalityDna(overrides?: Partial<PersonalityDna>): PersonalityDna {
  return {
    base: makePersonalityLayer(overrides?.base),
    adaptive: makePersonalityLayer(overrides?.adaptive)
  }
}

export function makeTrustAssessment(overrides?: Partial<TrustAssessment>): TrustAssessment {
  return {
    canAct: false,
    requiresApproval: true,
    fearLevel: 0.8,
    confidenceLevel: 0.1,
    experienceFactor: 0.0,
    reason: "Default: no experience",
    autonomyLevel: "approval_required",
    ...overrides
  }
}

export function makePendingEmail(overrides?: Partial<PendingEmail>): PendingEmail {
  return {
    emailId: "email-001",
    from: "sender@example.com",
    to: ["anima@yourdomain.com"],
    subject: "Test Email",
    text: "Hello from test",
    receivedAt: new Date().toISOString(),
    ...overrides
  }
}

export function makePerceptionSummary(overrides?: Partial<PerceptionSummary>): PerceptionSummary {
  return {
    timestamp: new Date().toISOString(),
    ownState: {
      budgetPercent: 25,
      lastTickAge: 60,
      errorCount: 0,
      healthStatus: "healthy"
    },
    telegramActivity: {
      pendingCount: 0,
      lastMessageAge: 300,
      operatorActive: false
    },
    emailActivity: {
      pendingCount: 0,
      lastEmailAge: -1,
      hasNewEmail: false
    },
    emotionalTriggers: [],
    ...overrides
  }
}

export function makeEmotionUpdateEvent(overrides?: Partial<EmotionUpdateEvent>): EmotionUpdateEvent {
  return {
    trigger: "idle_tick",
    intensity: 0.5,
    ...overrides
  }
}

export function makeMetricsSnapshot(overrides?: Partial<MetricsSnapshot>): MetricsSnapshot {
  return {
    errorRate: 0,
    successRate: 1,
    idleRatio: 0.7,
    rollbackCount: 0,
    tickCount: 100,
    interactionCount: 30,
    ...overrides
  }
}

export function makeReflectionInput(overrides?: Partial<ReflectionInput>): ReflectionInput {
  return {
    successRate: 0.85,
    errorRate: 0.05,
    costToday: 3.5,
    tickCount: 100,
    operatorInteractions: 12,
    operatorSentiment: 0.8,
    emotionalHistory: [],
    personalityChanges: [],
    unresolvedGoals: [],
    failedExperiments: [],
    ...overrides
  }
}

export function makeReflectionOutput(overrides?: Partial<ReflectionOutput>): ReflectionOutput {
  return {
    insights: ["Today was productive with good operator interactions."],
    ...overrides
  }
}

export function makeConsolidationResult(overrides?: Partial<ConsolidationResult>): ConsolidationResult {
  return {
    episodesProcessed: 25,
    semanticEntriesCreated: 5,
    connectionsFound: 3,
    downgraded: 2,
    ...overrides
  }
}

export function makeSandboxResult(overrides?: Partial<SandboxResult>): SandboxResult {
  return {
    passed: true,
    testsPassed: 42,
    testsFailed: 0,
    healthCheckPassed: true,
    stdout: "All tests passed",
    stderr: "",
    durationMs: 15000,
    ...overrides
  }
}

export function makeWorkflowDefinition(overrides?: Partial<WorkflowDefinition>): WorkflowDefinition {
  return {
    id: "wf-test-1",
    name: "Test Workflow",
    description: "A test workflow",
    trigger: { type: "schedule", hour: 9 },
    instruction: "Summarize goals and report",
    model: "sonnet",
    dataSources: ["goals"],
    outputAction: "log_only",
    enabled: true,
    createdBy: "dream",
    executionCount: 0,
    lastExecutedAt: null,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  }
}

export function makeWorkflowExecutionResult(overrides?: Partial<WorkflowExecutionResult>): WorkflowExecutionResult {
  return {
    workflowId: "wf-test-1",
    workflowName: "Test Workflow",
    success: true,
    output: "Workflow output",
    ...overrides
  }
}

export function makeWeatherData(overrides?: Partial<WeatherData>): WeatherData {
  return {
    temperature: 20,
    feelsLike: 19,
    humidity: 55,
    pressure: 1013,
    windSpeed: 3.5,
    condition: "Clear",
    description: "clear sky",
    cloudPercent: 10,
    isDay: true,
    locationName: "Mannheim",
    fetchedAt: new Date().toISOString(),
    ...overrides
  }
}

export function makeOperatorLocation(overrides?: Partial<OperatorLocation>): OperatorLocation {
  return {
    latitude: 49.4875,
    longitude: 8.466,
    cityName: "Mannheim",
    source: "telegram",
    updatedAt: new Date().toISOString(),
    ...overrides
  }
}

export function makeProactiveResult(overrides?: Partial<ProactiveResult>): ProactiveResult {
  return {
    action: "nothing",
    ...overrides
  }
}
