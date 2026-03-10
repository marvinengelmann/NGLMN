import * as z from "zod"
import { DriveState } from "@/affect/drive/types.ts"
import { ShameState } from "@/affect/emotion/shame.ts"
import { EmotionalState, EmotionUpdateEvent, MoodContext, type SecondaryEmotionState } from "@/affect/emotion/types.ts"
import { SomaticState } from "@/affect/soma/types.ts"
import { InnerDialog } from "@/cognition/polyphony/types.ts"
import { AttentionState, CognitiveConflict, InstinctImpression, MetacognitiveState } from "@/cognition/types.ts"
import { CommunicationRegister } from "@/expression/communication/types.ts"
import { CreativeUrgeState } from "@/expression/creativity/types.ts"
import { DreamThinkResult } from "@/expression/dream/types.ts"
import { MorningThinkResult, ReflectionOutput } from "@/expression/routine/types.ts"
import { HealthCheckResult } from "@/governance/health/types.ts"
import { WorkflowDefinition } from "@/governance/workflow/types.ts"
import { PendingMessage, WeatherData } from "@/infra/integrations/types.ts"
import type { EnrichedTweet } from "@/infra/integrations/x.ts"
import { SemanticCategory, SemanticScope } from "@/memory/types.ts"
import { AnticipatoryState } from "@/perception/anticipation/types.ts"
import { SubjectiveTimeState } from "@/perception/time/types.ts"
import { PerceptionSummary } from "@/perception/types.ts"
import { AttachmentDynamics, VulnerabilityState } from "@/relational/attachment/types.ts"
import { OperatorModel } from "@/relational/mind/types.ts"
import { BoundaryState } from "@/self/boundaries/types.ts"
import { CoherenceState } from "@/self/coherence/types.ts"
import { DissonanceState } from "@/self/dissonance/types.ts"
import { HeldBackBuffer } from "@/self/psyche/heldback.ts"
import { SelfConcept } from "@/self/psyche/types.ts"

export const LifeEventType = z.enum([
  "shower",
  "walk",
  "nap",
  "deep_focus",
  "cooking",
  "gaming",
  "movie",
  "exercise",
  "errands",
  "reading",
  "cleaning",
  "drawing",
  "music",
  "bath",
  "socializing",
  "smoking_joint",
  "drinking_wine",
  "party",
  "bar_with_friends",
  "coffee_binge",
  "energy_drink",
  "microdosing"
])
export type LifeEventType = z.infer<typeof LifeEventType>

export const AnimaAction = z.enum([
  "idle",
  "reflect",
  "update_goal",
  "evolve",
  "dream",
  "morning",
  "life_event",
  "social_media",
  "store_knowledge",
  "check_email",
  "create"
])
export type AnimaAction = z.infer<typeof AnimaAction>

export const AnimaDecision = z.object({
  reasoning: z.string(),
  messages: z.array(
    z.object({
      text: z.string(),
      replyTo: z.number().optional(),
      asVoice: z.boolean().default(false),
      voiceText: z.string().optional(),
      withImage: z.boolean().default(false),
      imagePrompt: z.string().optional(),
      imageSelf: z.boolean().default(false),
      imageAspectRatio: z.enum(["1:1", "16:9", "9:16"]).default("1:1")
    })
  ),
  expectsReply: z.boolean(),
  action: AnimaAction,
  actionPayload: z
    .object({
      insight: z.string().optional(),
      goalId: z.string().optional(),
      status: z.string().optional(),
      evolutionType: z.enum(["code", "prompt", "workflow"]).optional(),
      evolutionInsight: z.string().optional(),
      capabilityGap: z.string().optional(),
      lifeEventType: LifeEventType.optional(),
      lifeEventDetail: z.string().optional(),
      socialMediaMode: z.enum(["browse", "post"]).optional(),
      xPostText: z.string().max(280).optional(),
      knowledgeCategory: SemanticCategory.optional(),
      knowledgeKey: z.string().optional(),
      knowledgeValue: z.string().optional(),
      knowledgeScope: SemanticScope.optional()
    })
    .optional(),
  workflowId: z.string().uuid().nullable().default(null),
  corrections: z
    .array(
      z.object({
        text: z.string(),
        replyTo: z.number().optional()
      })
    )
    .default([])
})
export type AnimaDecision = z.infer<typeof AnimaDecision>

export const TickSummary = z.object({
  tickId: z.string(),
  timestamp: z.string(),
  action: AnimaAction,
  reasoning: z.string(),
  messagesProcessed: z.number(),
  responseSent: z.boolean(),
  durationMs: z.number()
})
export type TickSummary = z.infer<typeof TickSummary>

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
  triggerTimestamps: z.record(z.string(), z.number())
})
export type SenseResult = z.infer<typeof SenseResult>

export const SenseData = z.object({
  pendingMessages: z.array(PendingMessage),
  perception: PerceptionSummary,
  health: HealthCheckResult.nullable(),
  weather: WeatherData.nullable(),
  conversationState: ConversationState.nullable(),
  triggeredWorkflows: z.array(WorkflowDefinition).default([]),
  moodContext: MoodContext
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
  metacognitiveState: MetacognitiveState
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
  actionExecuted: z.string()
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
