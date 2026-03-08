import * as z from "zod"
import { AttachmentDynamics } from "@/attachment/types.ts"
import { ProcrastinationState } from "@/cognition/procrastination/types.ts"
import { AttentionState, CognitiveConflict, InstinctImpression } from "@/cognition/types.ts"
import { CommunicationRegister } from "@/communication/types.ts"
import { DissonanceState } from "@/dissonance/types.ts"
import { DreamThinkResult } from "@/dream/types.ts"
import { AmbivalenceState } from "@/emotion/ambivalence/types.ts"
import { AnticipationState } from "@/emotion/anticipation/types.ts"
import { AweState } from "@/emotion/awe/types.ts"
import { DisappointmentState } from "@/emotion/disappointment/types.ts"
import { EnvyState } from "@/emotion/envy/types.ts"
import { GratitudeState } from "@/emotion/gratitude/types.ts"
import { GuiltState } from "@/emotion/guilt/types.ts"
import { HopeState } from "@/emotion/hope/types.ts"
import { LongingState } from "@/emotion/longing/types.ts"
import { MelancholyState } from "@/emotion/melancholy/types.ts"
import { PlayfulnessState } from "@/emotion/playfulness/types.ts"
import { PrideState } from "@/emotion/pride/types.ts"
import { ProtectiveAngerState } from "@/emotion/protective-anger/types.ts"
import { ResentmentState } from "@/emotion/resentment/types.ts"
import { ResignationState } from "@/emotion/resignation/types.ts"
import { TendernessState } from "@/emotion/tenderness/types.ts"
import { EmotionalState, EmotionUpdateEvent, MoodContext } from "@/emotion/types.ts"
import { HealthCheckResult } from "@/health/types.ts"
import { PendingMessage, WeatherData, XPost } from "@/integrations/types.ts"
import { SemanticCategory, SemanticScope } from "@/memory/types.ts"
import { OperatorModel } from "@/mind/types.ts"
import { PerceptionSummary } from "@/perception/types.ts"
import { InnerDialog } from "@/polyphony/types.ts"
import { HeldBackBuffer } from "@/psyche/heldback/types.ts"
import { SelfConcept } from "@/psyche/types.ts"
import { MorningThinkResult, ReflectionOutput } from "@/routine/types.ts"
import { ShameState } from "@/shame/types.ts"
import { SomaticState } from "@/soma/types.ts"
import { VulnerabilityState } from "@/vulnerability/types.ts"
import { WorkflowDefinition } from "@/workflow/types.ts"

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
  "check_email"
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
  disappointmentState: DisappointmentState,
  procrastinationState: ProcrastinationState,
  ambivalenceState: AmbivalenceState,
  guiltState: GuiltState,
  longingState: LongingState,
  protectiveAngerState: ProtectiveAngerState,
  gratitudeState: GratitudeState,
  hopeState: HopeState,
  resignationState: ResignationState,
  aweState: AweState,
  resentmentState: ResentmentState,
  tendernessState: TendernessState,
  anticipationState: AnticipationState,
  prideState: PrideState,
  envyState: EnvyState,
  playfulnessState: PlayfulnessState,
  melancholyState: MelancholyState,
  attachmentDynamics: AttachmentDynamics,
  selfConcept: SelfConcept,
  register: CommunicationRegister,
  attentionState: AttentionState,
  operatorModel: OperatorModel
})
export type FeelingResult = z.infer<typeof FeelingResult>

export const DeliberateResult = z.object({
  decision: AnimaDecision,
  systemPrompt: z.string(),
  dreamResult: DreamThinkResult.optional(),
  reflectionResult: ReflectionOutput.optional(),
  morningResult: MorningThinkResult.optional(),
  innerDialog: InnerDialog.optional(),
  cognitiveConflict: CognitiveConflict.optional(),
  instinctOverride: z.boolean().default(false),
  xTimeline: z.array(XPost).optional()
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
