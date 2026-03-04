import * as z from "zod"
import { DreamThinkResult } from "@/dream/types.ts"
import { EmotionalState, MoodContext } from "@/emotion/types.ts"
import { HealthCheckResult } from "@/health/types.ts"
import { PendingMessage, WeatherData } from "@/integrations/types.ts"
import { PerceptionSummary } from "@/perception/types.ts"
import { MorningThinkResult, ReflectionOutput } from "@/routine/types.ts"
import { WorkflowDefinition } from "@/workflow/types.ts"

export const AnimaAction = z.enum(["idle", "reflect", "update_goal", "evolve", "dream", "morning"])
export type AnimaAction = z.infer<typeof AnimaAction>

export const AnimaDecision = z.object({
  reasoning: z.string(),
  messages: z.array(
    z.object({
      text: z.string(),
      replyTo: z.number().optional()
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
      capabilityGap: z.string().optional()
    })
    .optional(),
  workflowId: z.string().uuid().nullable().default(null)
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
  systemPrompt: z.string(),
  userPrompt: z.string(),
  pendingMessages: z.array(PendingMessage),
  perception: PerceptionSummary,
  emotion: EmotionalState,
  health: HealthCheckResult.nullable(),
  conversationState: ConversationState.nullable(),
  triggeredWorkflows: z.array(WorkflowDefinition).default([]),
  moodContext: MoodContext
})
export type SenseResult = z.infer<typeof SenseResult>

export const SenseData = z.object({
  pendingMessages: z.array(PendingMessage),
  perception: PerceptionSummary,
  emotion: EmotionalState,
  health: HealthCheckResult.nullable(),
  weather: WeatherData.nullable(),
  conversationState: ConversationState.nullable(),
  triggeredWorkflows: z.array(WorkflowDefinition).default([]),
  moodContext: MoodContext
})
export type SenseData = z.infer<typeof SenseData>

export const ThinkResult = z.object({
  decision: AnimaDecision,
  dreamResult: DreamThinkResult.optional(),
  reflectionResult: ReflectionOutput.optional(),
  morningResult: MorningThinkResult.optional()
})
export type ThinkResult = z.infer<typeof ThinkResult>

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
