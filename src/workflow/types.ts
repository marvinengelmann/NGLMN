import * as z from "zod"

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

export const WorkflowOutputAction = z.enum(["telegram_send", "store_episode", "create_goal", "log_only"])
export type WorkflowOutputAction = z.infer<typeof WorkflowOutputAction>

export const WorkflowDefinition = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  trigger: WorkflowTrigger,
  instruction: z.string(),
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
