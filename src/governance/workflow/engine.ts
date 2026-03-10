import { differenceInHours, formatISO, getDay, getHours, getMinutes } from "date-fns"
import { desc, eq, sql } from "drizzle-orm"
import { getEmotionHistory } from "@/affect/emotion/state.ts"
import { EmotionalState } from "@/affect/emotion/types.ts"
import { AnimaAction, type TickSummary } from "@/consciousness/types.ts"
import { callIntelligence } from "@/core/intelligence.ts"
import { BooleanOutput, TextOutput } from "@/core/types.ts"
import { db } from "@/infra/db/client.ts"
import { tickLog, workflows } from "@/infra/db/schema.ts"
import { sendToOperator } from "@/infra/integrations/telegram.ts"
import { animaError, logAndCaptureError, trySafe, zodParse } from "@/infra/lib/result.ts"
import { nowLocal } from "@/infra/lib/time.ts"
import { storeEpisode } from "@/memory/episodic.ts"
import { createGoal } from "@/memory/goals.ts"
import { getOperatorLanguage } from "@/memory/semantic.ts"
import type { PerceptionSummary } from "@/perception/types.ts"
import { PERCEPTION_TRIGGER_EVAL_PROMPT, WORKFLOW_EXECUTION_SYSTEM_PROMPT } from "@/prompts/workflow.ts"
import { recordFailure, recordSuccess } from "@/relational/trust/compute.ts"
import { WORKFLOW } from "./constants.ts"
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

  return rows.flatMap((row) => {
    const trigger = zodParse(WorkflowTrigger, row.trigger, "WORKFLOW_ERROR")
    if (trigger.isErr()) {
      logAndCaptureError(trigger.error, { workflowId: row.id, field: "trigger" })
      return []
    }
    const outputAction = zodParse(WorkflowOutputAction, row.outputAction, "WORKFLOW_ERROR")
    if (outputAction.isErr()) {
      logAndCaptureError(outputAction.error, { workflowId: row.id, field: "outputAction" })
      return []
    }
    return [
      {
        id: row.id,
        name: row.name,
        description: row.description ?? null,
        trigger: trigger.value,
        instruction: row.instruction,
        outputAction: outputAction.value,
        enabled: row.enabled ?? false,
        createdBy: row.createdBy,
        executionCount: row.executionCount ?? 0,
        lastExecutedAt: row.lastExecutedAt ? formatISO(row.lastExecutedAt) : null,
        version: row.version ?? 1,
        createdAt: formatISO(row.createdAt ?? new Date()),
        updatedAt: formatISO(row.updatedAt ?? new Date())
      }
    ]
  })
}

/**
 * Get recent tick summaries from the database.
 */
export async function getRecentTickSummaries(limit: number = 50): Promise<TickSummary[]> {
  const rows = await db.select().from(tickLog).orderBy(desc(tickLog.createdAt)).limit(limit)

  return rows.flatMap((row) => {
    const action = zodParse(AnimaAction, row.action, "WORKFLOW_ERROR")
    if (action.isErr()) {
      logAndCaptureError(action.error, { tickId: row.tickId, field: "action" })
      return []
    }
    return [
      {
        tickId: row.tickId,
        timestamp: row.timestamp.toISOString(),
        action: action.value,
        reasoning: row.reasoning,
        messagesProcessed: row.messagesProcessed,
        responseSent: row.responseSent,
        durationMs: row.durationMs
      }
    ]
  })
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
    if (workflow.lastExecutedAt) {
      const hoursSinceLastExec = differenceInHours(new Date(), new Date(workflow.lastExecutedAt))
      if (hoursSinceLastExec < WORKFLOW.MIN_EXECUTION_GAP_HOURS) continue
    }

    const shouldTrigger = await evaluateTrigger(workflow.trigger, emotion, perception, recentActions)

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

  if (trigger.minute !== undefined) {
    const diff = Math.abs(currentMinute - trigger.minute)
    const wrappedDiff = Math.min(diff, 60 - diff)
    if (wrappedDiff > 10) return false
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
      const parsed = EmotionalState.safeParse(entry.state)
      if (!parsed.success) return false
      const value = parsed.data[trigger.dimension]
      return trigger.operator === "gt" ? value > trigger.threshold : value < trigger.threshold
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
    maxTokens: 10,
    reasoning: false
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
      executionCount: sql`${workflows.executionCount} + 1`,
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
  const parsedAction = zodParse(WorkflowOutputAction, action, "WORKFLOW_ERROR")
  if (parsedAction.isErr()) {
    logAndCaptureError(parsedAction.error, { action })
    return
  }

  switch (parsedAction.value) {
    case "telegram_send":
      await sendToOperator(output)
      break
    case "store_episode":
      await storeEpisode(output, "observation", { relevanceScore: 0.7 })
      break
    case "create_goal": {
      let parsed: unknown
      try {
        parsed = JSON.parse(output)
      } catch {
        logAndCaptureError(animaError("WORKFLOW_ERROR", `Invalid JSON in create_goal output: ${output.slice(0, 100)}`))
        return
      }
      const goalData = zodParse(WorkflowGoalOutput, parsed, "WORKFLOW_ERROR")
      if (goalData.isErr()) {
        logAndCaptureError(goalData.error)
        return
      }
      const goalResult = await createGoal(
        goalData.value.title,
        goalData.value.description,
        "self",
        goalData.value.priority
      )
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
