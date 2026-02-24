import * as z from "zod"

export const TriageDecision = z.enum(["idle", "simple", "complex", "deep"])
export type TriageDecision = z.infer<typeof TriageDecision>

export const TriageResult = z.object({
  decision: TriageDecision,
  reason: z.string(),
  confidence: z.number().min(0).max(1),
  estimatedTokens: z.number().int().nonnegative()
})
export type TriageResult = z.infer<typeof TriageResult>

export const TickSummary = z.object({
  tickId: z.string(),
  timestamp: z.string(),
  triageDecision: TriageDecision,
  triageReason: z.string(),
  messagesProcessed: z.number(),
  responseSent: z.boolean(),
  modelUsed: z.string().optional(),
  tier: z.string().optional(),
  durationMs: z.number()
})
export type TickSummary = z.infer<typeof TickSummary>

export const WorkflowTrigger = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("schedule"),
    hour: z.number().min(0).max(23),
    minute: z.number().min(0).max(59).optional(),
    daysOfWeek: z.array(z.number().min(0).max(6)).optional()
  }),
  z.object({
    type: z.literal("emotion"),
    dimension: z.enum(["curiosity", "satisfaction", "frustration", "boredom", "excitement", "caution", "connection"]),
    operator: z.enum(["gt", "lt"]),
    threshold: z.number().min(0).max(1),
    sustainedTicks: z.number().int().positive().optional()
  }),
  z.object({
    type: z.literal("perception"),
    condition: z.string()
  }),
  z.object({
    type: z.literal("idle_streak"),
    consecutiveTicks: z.number().int().positive()
  })
])
export type WorkflowTrigger = z.infer<typeof WorkflowTrigger>

export const WorkflowDataSource = z.enum([
  "goals",
  "perception",
  "emotion",
  "recent_episodes",
  "semantic_knowledge",
  "conversation_history",
  "tick_history"
])
export type WorkflowDataSource = z.infer<typeof WorkflowDataSource>

export const WorkflowOutputAction = z.enum(["telegram_send", "store_episode", "create_goal", "log_only", "email_send"])
export type WorkflowOutputAction = z.infer<typeof WorkflowOutputAction>

export const WorkflowDefinition = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  trigger: WorkflowTrigger,
  instruction: z.string(),
  model: z.string(),
  dataSources: z.array(WorkflowDataSource),
  outputAction: WorkflowOutputAction,
  enabled: z.boolean(),
  createdBy: z.string(),
  executionCount: z.number(),
  lastExecutedAt: z.string().nullable(),
  version: z.number(),
  createdAt: z.string(),
  updatedAt: z.string()
})
export type WorkflowDefinition = z.infer<typeof WorkflowDefinition>

export const WorkflowGoalOutput = z.object({
  title: z.string(),
  description: z.string(),
  priority: z.number()
})
export type WorkflowGoalOutput = z.infer<typeof WorkflowGoalOutput>

export const WorkflowExecutionResult = z.object({
  workflowId: z.string(),
  workflowName: z.string(),
  success: z.boolean(),
  output: z.string().optional(),
  error: z.string().optional()
})
export type WorkflowExecutionResult = z.infer<typeof WorkflowExecutionResult>
