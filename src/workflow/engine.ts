import { differenceInHours, formatISO, getDay, getHours, getMinutes } from "date-fns"
import { desc, eq } from "drizzle-orm"
import { WORKFLOW } from "@/config/constants.ts"
import { AnimaAction, type TickSummary } from "@/consciousness/types.ts"
import { callIntelligence } from "@/core/intelligence.ts"
import { BooleanOutput, TextOutput } from "@/core/types.ts"
import { db } from "@/db/client.ts"
import { tickLog, workflows } from "@/db/schema.ts"
import { getEmotionHistory } from "@/emotion/state.ts"
import { EmotionalState } from "@/emotion/types.ts"
import { sendToOperator } from "@/integrations/telegram.ts"
import { logAndCaptureError, trySafe } from "@/lib/result.ts"
import { nowLocal } from "@/lib/time.ts"
import { storeEpisode } from "@/memory/episodic.ts"
import { createGoal } from "@/memory/goals.ts"
import { getOperatorLanguage } from "@/memory/semantic.ts"
import type { PerceptionSummary } from "@/perception/types.ts"
import { PERCEPTION_TRIGGER_EVAL_PROMPT, WORKFLOW_EXECUTION_SYSTEM_PROMPT } from "@/prompts/workflow.ts"
import { recordFailure, recordSuccess } from "@/trust/history.ts"
import {
  type WorkflowDefinition,
  type WorkflowExecutionResult,
  WorkflowGoalOutput,
  WorkflowOutputAction,
  WorkflowTrigger
} from "./types.ts"

/**
 * Get all enabled workflows from the database.
 */
export async function getActiveWorkflows(): Promise<WorkflowDefinition[]> {
  const rows = await db.select().from(workflows).where(eq(workflows.enabled, true))

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    trigger: WorkflowTrigger.parse(row.trigger),
    instruction: row.instruction,
    outputAction: WorkflowOutputAction.parse(row.outputAction),
    enabled: row.enabled ?? false,
    createdBy: row.createdBy,
    executionCount: row.executionCount ?? 0,
    lastExecutedAt: row.lastExecutedAt ? formatISO(row.lastExecutedAt) : null,
    version: row.version ?? 1,
    createdAt: formatISO(row.createdAt ?? new Date()),
    updatedAt: formatISO(row.updatedAt ?? new Date())
  }))
}

/**
 * Get recent tick summaries from the database.
 */
export async function getRecentTickSummaries(limit: number = 50): Promise<TickSummary[]> {
  const rows = await db.select().from(tickLog).orderBy(desc(tickLog.createdAt)).limit(limit)

  return rows.map((row) => ({
    tickId: row.tickId,
    timestamp: row.timestamp.toISOString(),
    action: AnimaAction.parse(row.action),
    reasoning: row.reasoning,
    messagesProcessed: row.messagesProcessed,
    responseSent: row.responseSent,
    durationMs: row.durationMs
  }))
}

/**
 * Check which workflows should be triggered given current state.
 */
export async function checkWorkflowTriggers(
  activeWorkflows: WorkflowDefinition[],
  emotion: EmotionalState,
  perception: PerceptionSummary | null,
  recentActions: string[]
): Promise<WorkflowDefinition[]> {
  const triggered: WorkflowDefinition[] = []

  for (const workflow of activeWorkflows) {
    const trigger = WorkflowTrigger.parse(workflow.trigger)

    if (workflow.lastExecutedAt) {
      const hoursSinceLastExec = differenceInHours(new Date(), new Date(workflow.lastExecutedAt))
      if (hoursSinceLastExec < WORKFLOW.MIN_EXECUTION_GAP_HOURS) continue
    }

    const shouldTrigger = await evaluateTrigger(trigger, emotion, perception, recentActions)

    if (shouldTrigger) {
      triggered.push(workflow)
    }
  }

  return triggered
}

async function evaluateTrigger(
  trigger: WorkflowDefinition["trigger"],
  emotion: EmotionalState,
  perception: PerceptionSummary | null,
  recentActions: string[]
): Promise<boolean> {
  switch (trigger.type) {
    case "schedule":
      return evaluateScheduleTrigger(trigger)
    case "emotion":
      return evaluateEmotionTrigger(trigger, emotion)
    case "perception":
      return evaluatePerceptionTrigger(trigger, perception)
    case "idle_streak":
      return evaluateIdleStreakTrigger(trigger, recentActions)
  }
}

function evaluateScheduleTrigger(trigger: Extract<WorkflowDefinition["trigger"], { type: "schedule" }>): boolean {
  const now = nowLocal()
  const currentHour = getHours(now)
  const currentMinute = getMinutes(now)
  const currentDay = getDay(now)

  if (currentHour !== trigger.hour) return false

  if (trigger.minute !== undefined && Math.abs(currentMinute - trigger.minute) > 10) {
    return false
  }

  if (trigger.daysOfWeek && trigger.daysOfWeek.length > 0) {
    if (!trigger.daysOfWeek.includes(currentDay)) return false
  }

  return true
}

async function evaluateEmotionTrigger(
  trigger: Extract<WorkflowDefinition["trigger"], { type: "emotion" }>,
  emotion: EmotionalState
): Promise<boolean> {
  const value = emotion[trigger.dimension]

  const meetsThreshold = trigger.operator === "gt" ? value > trigger.threshold : value < trigger.threshold

  if (!meetsThreshold) return false

  if (trigger.sustainedTicks && trigger.sustainedTicks > 1) {
    const history = await getEmotionHistory(trigger.sustainedTicks)
    if (history.length < trigger.sustainedTicks) return false

    return history.every((entry) => {
      const state = EmotionalState.parse(entry.state)
      const val = state[trigger.dimension]
      return trigger.operator === "gt" ? val > trigger.threshold : val < trigger.threshold
    })
  }

  return true
}

async function evaluatePerceptionTrigger(
  trigger: Extract<WorkflowDefinition["trigger"], { type: "perception" }>,
  perception: PerceptionSummary | null
): Promise<boolean> {
  if (!perception) return false

  const userMessage = `${PERCEPTION_TRIGGER_EVAL_PROMPT}\n\nCondition: ${trigger.condition}\n\nPerception data:\n${JSON.stringify(perception)}`

  const callResult = await callIntelligence({
    system: "Evaluate whether the perception data matches the given condition.",
    userMessage,
    schema: BooleanOutput,
    maxTokens: 10
  })

  if (callResult.isErr()) return false
  return callResult.value.result
}

function evaluateIdleStreakTrigger(
  trigger: Extract<WorkflowDefinition["trigger"], { type: "idle_streak" }>,
  recentActions: string[]
): boolean {
  if (recentActions.length < trigger.consecutiveTicks) return false

  const streak = recentActions.slice(0, trigger.consecutiveTicks)
  return streak.every((d) => d === "idle")
}

async function finalizeWorkflow(workflow: WorkflowDefinition, output: string): Promise<void> {
  await performOutputAction(workflow.outputAction, output)

  await db
    .update(workflows)
    .set({
      executionCount: (workflow.executionCount ?? 0) + 1,
      lastExecutedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(workflows.id, workflow.id))

  await storeEpisode(`Workflow "${workflow.name}" executed: ${output.slice(0, 200)}`, "observation", {
    relevanceScore: 0.7
  })
}

function workflowFailure(workflow: WorkflowDefinition, errorMessage: string): WorkflowExecutionResult {
  return {
    workflowId: workflow.id,
    workflowName: workflow.name,
    success: false,
    error: errorMessage
  }
}

/**
 * Build the user message for workflow execution — workflow instruction + metadata.
 */
async function buildWorkflowUserMessage(workflow: WorkflowDefinition): Promise<string> {
  const isOperatorFacing = workflow.outputAction === "telegram_send"
  const operatorLanguage = isOperatorFacing ? await getOperatorLanguage() : null

  return [
    `## Workflow: ${workflow.name}`,
    workflow.description ? `Description: ${workflow.description}` : "",
    `Output action: ${workflow.outputAction}`,
    operatorLanguage ? `Operator's preferred language: ${operatorLanguage}` : "",
    "",
    `## Instruction`,
    workflow.instruction
  ]
    .filter(Boolean)
    .join("\n")
}

/**
 * Execute a single workflow using the full ANIMA system prompt from SENSE.
 */
export async function executeWorkflow(
  workflow: WorkflowDefinition,
  systemPrompt: string
): Promise<WorkflowExecutionResult> {
  const userMessage = await buildWorkflowUserMessage(workflow)

  if (workflow.outputAction === "create_goal") {
    const callResult = await callIntelligence({
      system: systemPrompt,
      userMessage: `${WORKFLOW_EXECUTION_SYSTEM_PROMPT}\n\n${userMessage}`,
      schema: WorkflowGoalOutput,
      maxTokens: 2048
    })

    if (callResult.isErr()) {
      await recordFailure("workflow_creation")
      return workflowFailure(workflow, callResult.error.message)
    }

    const output = JSON.stringify(callResult.value)
    const postResult = await trySafe("WORKFLOW_ERROR", () => finalizeWorkflow(workflow, output))
    if (postResult.isErr()) {
      await recordFailure("workflow_creation")
      return workflowFailure(workflow, postResult.error.message)
    }

    await recordSuccess("workflow_creation")
    return { workflowId: workflow.id, workflowName: workflow.name, success: true, output }
  }

  const callResult = await callIntelligence({
    system: systemPrompt,
    userMessage: `${WORKFLOW_EXECUTION_SYSTEM_PROMPT}\n\n${userMessage}`,
    schema: TextOutput,
    maxTokens: 2048
  })

  if (callResult.isErr()) {
    await recordFailure("workflow_creation")
    return workflowFailure(workflow, callResult.error.message)
  }

  const output = callResult.value.text

  const postResult = await trySafe("WORKFLOW_ERROR", () => finalizeWorkflow(workflow, output))

  if (postResult.isErr()) {
    await recordFailure("workflow_creation")
    return workflowFailure(workflow, postResult.error.message)
  }

  await recordSuccess("workflow_creation")
  return {
    workflowId: workflow.id,
    workflowName: workflow.name,
    success: true,
    output
  }
}

async function performOutputAction(action: string, output: string): Promise<void> {
  const parsedAction = WorkflowOutputAction.parse(action)

  switch (parsedAction) {
    case "telegram_send":
      await sendToOperator(output)
      break
    case "store_episode":
      await storeEpisode(output, "observation", { relevanceScore: 0.7 })
      break
    case "create_goal": {
      const goalData = WorkflowGoalOutput.parse(JSON.parse(output))
      const goalResult = await createGoal(goalData.title, goalData.description, "self", goalData.priority)
      if (goalResult.isErr()) logAndCaptureError(goalResult.error)
      break
    }
    case "log_only":
      break
  }
}

/**
 * Get the count of active workflows.
 */
export async function getActiveWorkflowCount(): Promise<number> {
  const rows = await db.select().from(workflows).where(eq(workflows.enabled, true))
  return rows.length
}

export const MAX_ACTIVE_WORKFLOWS = WORKFLOW.MAX_ACTIVE
