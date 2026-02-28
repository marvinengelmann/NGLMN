import { differenceInHours, formatISO, getDay, getHours, getMinutes } from "date-fns"
import { desc, eq } from "drizzle-orm"
import { WORKFLOW } from "@/config/constants.ts"
import { buildIdentityPrompt } from "@/core/identity.ts"
import { BooleanOutput, callIntelligence, FAST, REASONING, TextOutput } from "@/core/intelligence.ts"
import type { TickSummary, WorkflowExecutionResult } from "@/core/types.ts"
import {
  TriageDecision,
  WorkflowDataSource,
  type WorkflowDefinition,
  WorkflowGoalOutput,
  WorkflowOutputAction,
  WorkflowTrigger
} from "@/core/types.ts"
import { db } from "@/db/client.ts"
import { tickLog, workflows } from "@/db/schema.ts"
import { getEmotionalState, getEmotionHistory } from "@/emotion/state.ts"
import { EmotionalState } from "@/emotion/types.ts"
import { sendEmailToOperator } from "@/integrations/resend.ts"
import { sendToOperator } from "@/integrations/telegram.ts"
import { logAndCaptureError, trySafe } from "@/lib/result.ts"
import { nowLocal } from "@/lib/time.ts"
import { queryRelated, storeEpisode } from "@/memory/episodic.ts"
import { createGoal, getActiveGoals } from "@/memory/goals.ts"
import { getKnowledge, getOperatorLanguage } from "@/memory/semantic.ts"
import { getAllConversationMessages, getPerceptionSummary } from "@/memory/working.ts"
import type { PerceptionSummary } from "@/perception/types.ts"
import { getEffectivePersonality } from "@/personality/dna.ts"
import { buildPersonalityPrompt } from "@/personality/expression.ts"
import { PERCEPTION_TRIGGER_EVAL_PROMPT, WORKFLOW_EXECUTION_SYSTEM_PROMPT } from "@/prompts/workflow.ts"
import { recordFailure, recordSuccess } from "@/trust/history.ts"

const MODEL_MAP: Record<string, string> = {
  fast: FAST,
  reasoning: REASONING
}

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
    model: row.model,
    dataSources: WorkflowDataSource.array().parse(row.dataSources),
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
    triageDecision: TriageDecision.parse(row.triageDecision),
    triageReason: row.triageReason,
    messagesProcessed: row.messagesProcessed,
    responseSent: row.responseSent,
    modelUsed: row.modelUsed ?? undefined,
    tier: row.tier ?? undefined,
    nextInterval: row.nextInterval ?? undefined,
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
  recentTriageDecisions: string[]
): Promise<WorkflowDefinition[]> {
  const triggered: WorkflowDefinition[] = []

  for (const workflow of activeWorkflows) {
    const trigger = WorkflowTrigger.parse(workflow.trigger)

    if (workflow.lastExecutedAt) {
      const hoursSinceLastExec = differenceInHours(new Date(), new Date(workflow.lastExecutedAt))
      if (hoursSinceLastExec < WORKFLOW.MIN_EXECUTION_GAP_HOURS) continue
    }

    const shouldTrigger = await evaluateTrigger(trigger, emotion, perception, recentTriageDecisions)

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
  recentTriageDecisions: string[]
): Promise<boolean> {
  switch (trigger.type) {
    case "schedule":
      return evaluateScheduleTrigger(trigger)
    case "emotion":
      return evaluateEmotionTrigger(trigger, emotion)
    case "perception":
      return evaluatePerceptionTrigger(trigger, perception)
    case "idle_streak":
      return evaluateIdleStreakTrigger(trigger, recentTriageDecisions)
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

  const prompt = PERCEPTION_TRIGGER_EVAL_PROMPT.replace("{condition}", trigger.condition).replace(
    "{perceptionData}",
    JSON.stringify(perception)
  )

  const callResult = await callIntelligence({
    model: FAST,
    system: "Evaluate whether the perception data matches the given condition.",
    userMessage: prompt,
    schema: BooleanOutput,
    maxTokens: 10
  })

  if (callResult.isErr()) return false
  return callResult.value.result
}

function evaluateIdleStreakTrigger(
  trigger: Extract<WorkflowDefinition["trigger"], { type: "idle_streak" }>,
  recentTriageDecisions: string[]
): boolean {
  if (recentTriageDecisions.length < trigger.consecutiveTicks) return false

  const streak = recentTriageDecisions.slice(0, trigger.consecutiveTicks)
  return streak.every((d) => d === "idle")
}

async function fetchGoalsData(): Promise<string[]> {
  const activeGoals = await getActiveGoals()
  if (activeGoals.length === 0) return []
  const lines = ["## Active Goals"]
  for (const g of activeGoals) {
    lines.push(`- [${g.status}] ${g.title} (priority: ${g.priority})${g.description ? `: ${g.description}` : ""}`)
  }
  return lines
}

async function fetchPerceptionData(): Promise<string[]> {
  const perc = await getPerceptionSummary()
  if (!perc) return []
  const lines = [
    "## Perception",
    `Budget: ${perc.ownState.budgetPercent}%, Health: ${perc.ownState.healthStatus}`,
    `Telegram: ${perc.telegramActivity.pendingCount} pending, operator ${perc.telegramActivity.operatorActive ? "active" : "inactive"}`
  ]
  if (perc.emailActivity) {
    lines.push(
      `Email: ${perc.emailActivity.pendingCount} pending, ${perc.emailActivity.hasNewEmail ? "new email" : "no new email"}`
    )
  }
  return lines
}

async function fetchEmotionData(): Promise<string[]> {
  const emo = await getEmotionalState()
  const lines = ["## Emotional State"]
  for (const [key, value] of Object.entries(emo)) {
    lines.push(`- ${key}: ${Number(value).toFixed(2)}`)
  }
  return lines
}

async function fetchRecentEpisodesData(): Promise<string[]> {
  const episodes = await queryRelated("recent activity and events", 10)
  if (episodes.length === 0) return []
  const lines = ["## Recent Episodes"]
  for (const ep of episodes) {
    if (ep.metadata) {
      lines.push(`- [${ep.metadata.category}] ${ep.metadata.timestamp} (relevance: ${ep.score.toFixed(2)})`)
    }
  }
  return lines
}

async function fetchSemanticKnowledgeData(): Promise<string[]> {
  const knowledgeResult = await getKnowledge()
  const knowledge = knowledgeResult.unwrapOr([])
  if (knowledge.length === 0) return []
  const lines = ["## Semantic Knowledge"]
  for (const k of knowledge.slice(0, 15)) {
    lines.push(`- [${k.category}] ${k.key}: ${JSON.stringify(k.value)}`)
  }
  return lines
}

async function fetchConversationHistoryData(): Promise<string[]> {
  const history = await getAllConversationMessages()
  if (history.length === 0) return []
  const lines = ["## Conversation History"]
  for (const msg of history) {
    const label = msg.role === "operator" ? "Operator" : "ANIMA"
    lines.push(`[${label}]: ${msg.text}`)
  }
  return lines
}

async function fetchTickHistoryData(): Promise<string[]> {
  const ticks = await getRecentTickSummaries(20)
  if (ticks.length === 0) return []
  const lines = ["## Recent Tick History"]
  for (const t of ticks.slice(0, 10)) {
    lines.push(`- ${t.timestamp}: ${t.triageDecision} — ${t.triageReason} (${t.durationMs}ms)`)
  }
  return lines
}

const dataFetchers: Record<string, () => Promise<string[]>> = {
  goals: fetchGoalsData,
  perception: fetchPerceptionData,
  emotion: fetchEmotionData,
  recent_episodes: fetchRecentEpisodesData,
  semantic_knowledge: fetchSemanticKnowledgeData,
  conversation_history: fetchConversationHistoryData,
  tick_history: fetchTickHistoryData
}

/**
 * Gather data from specified sources and format as readable text.
 */
export async function gatherWorkflowData(dataSources: string[]): Promise<string> {
  const parts: string[] = []

  for (const source of dataSources) {
    const fetcher = dataFetchers[source]
    if (fetcher) {
      const lines = await fetcher()
      parts.push(...lines)
    }
  }

  return parts.join("\n")
}

async function prepareWorkflowContext(workflow: WorkflowDefinition): Promise<string> {
  const isOperatorFacing = workflow.outputAction === "telegram_send"

  const [data, personality, emotion, operatorLanguage, identityPrompt] = await Promise.all([
    gatherWorkflowData(workflow.dataSources),
    getEffectivePersonality(),
    getEmotionalState(),
    isOperatorFacing ? getOperatorLanguage() : Promise.resolve(null),
    buildIdentityPrompt()
  ])

  const personalityPrompt = personality
    ? `${identityPrompt}\n\n${buildPersonalityPrompt(personality, emotion)}`
    : identityPrompt

  return [
    `## Workflow: ${workflow.name}`,
    workflow.description ? `Description: ${workflow.description}` : "",
    `Output action: ${workflow.outputAction}`,
    operatorLanguage ? `Operator's preferred language: ${operatorLanguage}` : `Response language: English`,
    "",
    `## Instruction`,
    workflow.instruction,
    "",
    personalityPrompt ? `## Personality Context\n${personalityPrompt}\n` : "",
    `## Gathered Data`,
    data
  ]
    .filter(Boolean)
    .join("\n")
}

async function finalizeWorkflow(workflow: WorkflowDefinition, output: string): Promise<void> {
  await performOutputAction(workflow.outputAction, output, workflow.name)

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
 * Execute a single workflow: gather data, call LLM, perform action.
 */
export async function executeWorkflow(workflow: WorkflowDefinition): Promise<WorkflowExecutionResult> {
  const model = MODEL_MAP[workflow.model] ?? REASONING

  const dataResult = await trySafe("WORKFLOW_ERROR", () => prepareWorkflowContext(workflow))

  if (dataResult.isErr()) {
    ;(await recordFailure("workflow_creation")).mapErr(logAndCaptureError)
    return workflowFailure(workflow, dataResult.error.message)
  }

  if (workflow.outputAction === "create_goal") {
    const callResult = await callIntelligence({
      model,
      system: WORKFLOW_EXECUTION_SYSTEM_PROMPT,
      userMessage: dataResult.value,
      schema: WorkflowGoalOutput,
      maxTokens: 2048
    })

    if (callResult.isErr()) {
      ;(await recordFailure("workflow_creation")).mapErr(logAndCaptureError)
      return workflowFailure(workflow, callResult.error.message)
    }

    const output = JSON.stringify(callResult.value)
    const postResult = await trySafe("WORKFLOW_ERROR", () => finalizeWorkflow(workflow, output))
    if (postResult.isErr()) {
      ;(await recordFailure("workflow_creation")).mapErr(logAndCaptureError)
      return workflowFailure(workflow, postResult.error.message)
    }

    ;(await recordSuccess("workflow_creation")).mapErr(logAndCaptureError)
    return { workflowId: workflow.id, workflowName: workflow.name, success: true, output }
  }

  const callResult = await callIntelligence({
    model,
    system: WORKFLOW_EXECUTION_SYSTEM_PROMPT,
    userMessage: dataResult.value,
    schema: TextOutput,
    maxTokens: 2048
  })

  if (callResult.isErr()) {
    ;(await recordFailure("workflow_creation")).mapErr(logAndCaptureError)
    return workflowFailure(workflow, callResult.error.message)
  }

  const output = callResult.value.text

  const postResult = await trySafe("WORKFLOW_ERROR", () => finalizeWorkflow(workflow, output))

  if (postResult.isErr()) {
    ;(await recordFailure("workflow_creation")).mapErr(logAndCaptureError)
    return workflowFailure(workflow, postResult.error.message)
  }

  ;(await recordSuccess("workflow_creation")).mapErr(logAndCaptureError)
  return {
    workflowId: workflow.id,
    workflowName: workflow.name,
    success: true,
    output
  }
}

async function performOutputAction(action: string, output: string, workflowName: string): Promise<void> {
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
    case "email_send":
      await sendEmailToOperator(`ANIMA Workflow: ${workflowName}`, output)
      break
    case "x_post": {
      const { hasXConfig } = await import("@/config/env.ts")
      if (!hasXConfig()) break
      const { validatePublicOutput } = await import("@/security/guardian.ts")
      const guardianResult = await validatePublicOutput(output)
      if (guardianResult.verdict === "blocked") break
      const { postTweet } = await import("@/integrations/x.ts")
      await postTweet(output)
      break
    }
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
