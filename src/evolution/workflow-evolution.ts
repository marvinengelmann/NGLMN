import { eq } from "drizzle-orm"
import * as z from "zod"
import type { AnimaResultAsync } from "@/config/result-helpers.ts"
import { logAndCaptureError, trySafe } from "@/config/result-helpers.ts"
import { callIntelligence, REASONING } from "@/core/intelligence.ts"
import type { TickSummary } from "@/core/types.ts"
import { WorkflowDataSource, WorkflowOutputAction, WorkflowTrigger } from "@/core/types.ts"
import { getActiveWorkflowCount, getActiveWorkflows, MAX_ACTIVE_WORKFLOWS } from "@/core/workflow-engine.ts"
import { db } from "@/db/client.ts"
import { workflows } from "@/db/schema.ts"
import { log } from "@/lib/logger.ts"
import { WORKFLOW_PROPOSAL_SYSTEM_PROMPT } from "@/prompts/workflow.ts"
import { validateOutput } from "@/security/guardian.ts"
import { canActAutonomously } from "@/trust/assessment.ts"
import { recordSuccess } from "@/trust/history.ts"
import { writeChangelogEntry } from "./changelog.ts"

export const WorkflowProposalOutput = z.object({
  shouldCreate: z.boolean(),
  reasoning: z.string(),
  name: z.string(),
  description: z.string(),
  trigger: WorkflowTrigger,
  instruction: z.string(),
  model: z.string(),
  dataSources: z.array(WorkflowDataSource),
  outputAction: WorkflowOutputAction
})
export type WorkflowProposalOutput = z.infer<typeof WorkflowProposalOutput>

export interface WorkflowProposal extends WorkflowProposalOutput {
  autonomous: boolean
}

/**
 * Propose a new workflow based on a detected behavioral pattern.
 */
export async function proposeWorkflow(pattern: string, tickHistory: TickSummary[]): Promise<WorkflowProposal> {
  const trust = await canActAutonomously("workflow_creation")
  const existingWorkflows = await getActiveWorkflows()

  const responseResult = await callIntelligence({
    model: REASONING,
    system: WORKFLOW_PROPOSAL_SYSTEM_PROMPT,
    userMessage: JSON.stringify({
      pattern,
      tickHistory: tickHistory.slice(0, 30),
      existingWorkflows: existingWorkflows.map((w) => ({
        name: w.name,
        trigger: w.trigger,
        outputAction: w.outputAction
      }))
    }),
    schema: WorkflowProposalOutput,
    maxTokens: 2048
  })

  if (responseResult.isErr()) {
    log.warn("Failed to propose workflow", { error: responseResult.error.message })
    return {
      shouldCreate: false,
      reasoning: responseResult.error.message,
      name: "",
      description: "",
      trigger: { type: "schedule", hour: 0 },
      instruction: "",
      model: "",
      dataSources: [],
      outputAction: "log_only",
      autonomous: false
    }
  }

  return {
    ...responseResult.value,
    autonomous: trust.canAct
  }
}

/**
 * Apply a workflow proposal: validate, insert into DB, and record in changelog.
 */
export function applyWorkflow(proposal: WorkflowProposal): AnimaResultAsync<string> {
  return trySafe("DB_ERROR", async () => {
    const activeCount = await getActiveWorkflowCount()
    if (activeCount >= MAX_ACTIVE_WORKFLOWS) {
      throw new Error(`Cannot create workflow: max active workflows (${MAX_ACTIVE_WORKFLOWS}) reached`)
    }

    const guardianResult = await validateOutput(proposal.instruction)
    if (guardianResult.verdict === "blocked") {
      throw new Error(`Guardian blocked workflow instruction: ${guardianResult.reasons.join(", ")}`)
    }

    const allowedModels = ["fast", "reasoning"]
    if (!allowedModels.includes(proposal.model)) {
      throw new Error(`Invalid workflow model "${proposal.model}" — must be "fast" or "reasoning"`)
    }

    const rows = await db
      .insert(workflows)
      .values({
        name: proposal.name,
        description: proposal.description,
        trigger: proposal.trigger,
        instruction: proposal.instruction,
        model: proposal.model,
        dataSources: proposal.dataSources,
        outputAction: proposal.outputAction,
        enabled: true,
        createdBy: "dream"
      })
      .returning({ id: workflows.id })

    const first = rows[0]
    if (!first) {
      throw new Error("Expected row from workflow insert")
    }

    const changelogResult = await writeChangelogEntry(
      "workflow",
      `Created workflow "${proposal.name}": ${proposal.description}`,
      "success"
    )
    if (changelogResult.isErr()) logAndCaptureError(changelogResult.error)

    const successResult = await recordSuccess("workflow_creation")
    if (successResult.isErr()) logAndCaptureError(successResult.error)

    return first.id
  })
}

/**
 * Disable a workflow by ID.
 */
export async function disableWorkflow(workflowId: string): Promise<void> {
  await db.update(workflows).set({ enabled: false, updatedAt: new Date() }).where(eq(workflows.id, workflowId))
}
