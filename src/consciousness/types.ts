import * as z from "zod"
import { DriveState } from "@/affect/drive/types.ts"
import type { DeferredEmotionalEvent } from "@/affect/emotion/deferred.ts"
import { ShameState } from "@/affect/emotion/shame.ts"
import {
  AppraisalResult,
  EmotionalState,
  EmotionUpdateEvent,
  MoodContext,
  type SecondaryEmotionState
} from "@/affect/emotion/types.ts"
import { InteroceptivePrediction, SomaticState, VagalConstraints, VagalState } from "@/affect/soma/types.ts"
import { BiasState } from "@/cognition/bias/types.ts"
import { InnerDialog } from "@/cognition/polyphony/types.ts"
import { AttentionState, CognitiveConflict, InstinctImpression, MetacognitiveState } from "@/cognition/types.ts"
import { AnimaDecision } from "@/core/types.ts"
import { CommunicationRegister } from "@/expression/communication/types.ts"
import { CreativeUrgeState } from "@/expression/creativity/types.ts"
import { DreamThinkResult } from "@/expression/dream/types.ts"
import { MorningThinkResult, ReflectionOutput } from "@/expression/routine/types.ts"
import { HealthCheckResult } from "@/governance/health/types.ts"
import { WorkflowDefinition } from "@/governance/workflow/types.ts"
import { PendingMessage, WeatherData } from "@/infra/integrations/types.ts"
import type { EnrichedTweet } from "@/infra/integrations/x.ts"
import { AnticipatoryState } from "@/perception/anticipation/types.ts"
import type { ProustFlashback } from "@/perception/proust.ts"
import { SubjectiveTimeState } from "@/perception/time/types.ts"
import { PerceptionSummary } from "@/perception/types.ts"
import { AttachmentDynamics, IsolationStress, VulnerabilityState } from "@/relational/attachment/types.ts"
import { OperatorModel } from "@/relational/mind/types.ts"
import { BoundaryState } from "@/self/boundaries/types.ts"
import { CoherenceState } from "@/self/coherence/types.ts"
import { DefenseState } from "@/self/defense/types.ts"
import { DissonanceState } from "@/self/dissonance/types.ts"
import { HeldBackBuffer } from "@/self/psyche/heldback.ts"
import { SelfConcept } from "@/self/psyche/types.ts"

export { AnimaAction, AnimaDecision, LifeEventType, TickSummary } from "@/core/types.ts"

export const ConversationState = z.object({
  waitingSeconds: z.number(),
  replyReceived: z.boolean()
})
export type ConversationState = z.infer<typeof ConversationState>

export const SenseResult = z.object({
  pendingMessages: z.array(PendingMessage),
  perception: PerceptionSummary,
  health: HealthCheckResult.nullable(),
  conversationState: ConversationState.nullable(),
  triggeredWorkflows: z.array(WorkflowDefinition).default([]),
  moodContext: MoodContext,
  rawTriggers: z.array(EmotionUpdateEvent),
  elapsedMinutes: z.number(),
  triggerTimestamps: z.record(z.string(), z.number()),
  interruptedPreviousSend: z.boolean().default(false),
  maxUpdateId: z.number().nullable().default(null)
})
export type SenseResult = z.infer<typeof SenseResult>

export const SenseData = z.object({
  pendingMessages: z.array(PendingMessage),
  perception: PerceptionSummary,
  health: HealthCheckResult.nullable(),
  weather: WeatherData.nullable(),
  conversationState: ConversationState.nullable(),
  triggeredWorkflows: z.array(WorkflowDefinition).default([]),
  moodContext: MoodContext,
  interruptedPreviousSend: z.boolean().default(false)
})
export type SenseData = z.infer<typeof SenseData>

export const FeelingResult = z.object({
  emotion: EmotionalState,
  soma: SomaticState,
  instinct: InstinctImpression,
  dissonance: DissonanceState,
  vulnerability: VulnerabilityState,
  shameState: ShameState,
  heldBackBuffer: HeldBackBuffer,
  secondaryEmotions: z.record(z.string(), z.unknown()),
  attachmentDynamics: AttachmentDynamics,
  selfConcept: SelfConcept,
  register: CommunicationRegister,
  attentionState: AttentionState,
  operatorModel: OperatorModel,
  driveState: DriveState,
  anticipatoryState: AnticipatoryState,
  subjectiveTime: SubjectiveTimeState,
  coherenceState: CoherenceState,
  creativeUrge: CreativeUrgeState,
  boundaryState: BoundaryState,
  metacognitiveState: MetacognitiveState,
  communicationSimplification: z.number().min(0).max(1).default(0),
  hedgingLevel: z.number().min(0).max(1).default(0),
  proustFlashback: z.custom<ProustFlashback>().nullable().default(null),
  maturedDeferredEvents: z.custom<DeferredEmotionalEvent[]>().default([]),
  vagalState: VagalState,
  vagalConstraints: VagalConstraints,
  interoceptivePrediction: InteroceptivePrediction.nullable().default(null),
  appraisalResults: z.array(AppraisalResult).default([]),
  isolationStress: IsolationStress,
  defenseState: DefenseState,
  defenseExpressionModifiers: z.string().nullable().default(null),
  biasState: BiasState
})
export type FeelingResult = z.infer<typeof FeelingResult>

export function getSecondaryEmotion<T extends SecondaryEmotionState>(result: FeelingResult, name: string): T {
  return result.secondaryEmotions[name] as T
}

export const DeliberateResult = z.object({
  decision: AnimaDecision,
  systemPrompt: z.string(),
  dreamResult: DreamThinkResult.optional(),
  reflectionResult: ReflectionOutput.optional(),
  morningResult: MorningThinkResult.optional(),
  innerDialog: InnerDialog.optional(),
  cognitiveConflict: CognitiveConflict.optional(),
  instinctOverride: z.boolean().default(false),
  xTimeline: z.array(z.any()).optional() as z.ZodOptional<z.ZodArray<z.ZodType<EnrichedTweet>>>,
  calendarChecked: z.boolean().optional()
})
export type DeliberateResult = z.infer<typeof DeliberateResult>

export const ActResult = z.object({
  responseSent: z.boolean(),
  responseText: z.string().optional(),
  actionExecuted: z.string(),
  interrupted: z.boolean().default(false),
  postActEmotion: EmotionalState.optional()
})
export type ActResult = z.infer<typeof ActResult>

export const MaintainInput = z.object({
  tickId: z.string(),
  startTime: z.number(),
  timestamp: z.string(),
  decision: AnimaDecision,
  actResult: ActResult,
  senseResult: SenseResult
})
export type MaintainInput = z.infer<typeof MaintainInput>
