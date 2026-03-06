import { collectMetrics } from "@/emotion/metrics.ts"
import { executeCodeEvolution, proposeCodeChange } from "@/evolution/code.ts"
import { applyPromptChange, loadPrompt, proposePromptChange } from "@/evolution/prompt.ts"
import type {
  CodeProposal,
  EvolutionCycleResult,
  EvolutionType,
  PreviousAttempt,
  PromptProposalOutput,
  WorkflowProposalOutput
} from "@/evolution/types.ts"
import { applyWorkflow, proposeWorkflow } from "@/evolution/workflow.ts"
import { log } from "@/lib/logger.ts"
import { logAndCaptureError } from "@/lib/result.ts"
import { captureError } from "@/lib/sentry.ts"
import { nowISO } from "@/lib/time.ts"
import {
  clearPendingEvolutionProposal,
  getPendingEvolutionProposal,
  getRecentResponses,
  setEvolutionCycleResult,
  setPendingEvolutionProposal,
  setTaskActive
} from "@/memory/working.ts"
import { getRecentTickSummaries } from "@/workflow/engine.ts"

const PROMPT_FALLBACKS: Record<string, string> = {}
const MAX_EVOLUTION_RETRIES = 3

interface EvolutionPayload {
  type: EvolutionType
  promptId?: string
  insight?: string
  capabilityGap?: string
  actionRequested?: boolean
  pendingProposal?: CodeProposal
}

interface EvolutionOutput {
  action: string
  result?: { success: boolean; error?: string }
  proposal?: CodeProposal | PromptProposalOutput | WorkflowProposalOutput
  commitSubject?: string
  reasoning?: string
  reason?: string
  promptId?: string
  version?: number
  workflowId?: string
}

/**
 * Runs a code evolution cycle directly. Manages pending proposals
 * in working memory and stores the outcome for context.
 */
export async function runEvolutionCycle(params: {
  insight?: string
  capabilityGap?: string
}): Promise<EvolutionCycleResult> {
  try {
    const pendingProposal = await getPendingEvolutionProposal()

    const result = await runEvolution({
      type: "code",
      insight: params.insight,
      capabilityGap: params.capabilityGap,
      actionRequested: !!pendingProposal,
      pendingProposal: pendingProposal ?? undefined
    })

    if (result.action === "applied") {
      await clearPendingEvolutionProposal()
      const outcome: EvolutionCycleResult = {
        action: "applied",
        commitSubject: result.commitSubject,
        insight: params.insight,
        capabilityGap: params.capabilityGap
      }
      await storeOutcome(outcome)
      log.info("Code evolution applied", { commitSubject: result.commitSubject })
      return outcome
    }

    if (result.action === "pending" && result.proposal && "shouldEvolve" in result.proposal) {
      await setPendingEvolutionProposal(result.proposal as CodeProposal)
      const commitSubject = result.commitSubject ?? (result.proposal as CodeProposal).commitSubject
      const outcome: EvolutionCycleResult = {
        action: "pending",
        commitSubject,
        insight: params.insight,
        capabilityGap: params.capabilityGap
      }
      await storeOutcome(outcome)
      log.info("Code evolution pending approval", { commitSubject })
      return outcome
    }

    if (result.action === "failed") {
      await clearPendingEvolutionProposal()
      const error = result.result?.error ?? "unknown error"
      const outcome: EvolutionCycleResult = {
        action: "failed",
        commitSubject: result.commitSubject,
        insight: params.insight,
        capabilityGap: params.capabilityGap,
        error
      }
      await storeOutcome(outcome)
      log.warn("Code evolution failed", {
        error,
        commitSubject: result.commitSubject,
        insight: params.insight,
        capabilityGap: params.capabilityGap
      })
      return outcome
    }

    const outcome: EvolutionCycleResult = {
      action: "denied",
      insight: params.insight,
      capabilityGap: params.capabilityGap,
      reasoning: result.reasoning
    }
    await storeOutcome(outcome)
    log.info("Code evolution denied", { action: result.action, reasoning: result.reasoning })
    return outcome
  } catch (error) {
    log.warn("Evolution cycle failed", { error: error instanceof Error ? error.message : String(error) })
    return { action: "error", error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Runs the full evolution lifecycle: sets task active flag, executes the
 * appropriate evolution type, and clears the flag on completion.
 */
export async function runEvolution(payload: EvolutionPayload): Promise<EvolutionOutput> {
  await setTaskActive(true)
  try {
    return await executeEvolutionType(payload)
  } finally {
    await setTaskActive(false)
  }
}

async function executeEvolutionType(payload: EvolutionPayload): Promise<EvolutionOutput> {
  log.info("Starting evolution", {
    type: payload.type,
    promptId: payload.promptId,
    insight: payload.insight,
    capabilityGap: payload.capabilityGap,
    actionRequested: payload.actionRequested,
    hasPendingProposal: !!payload.pendingProposal
  })

  if (payload.type === "prompt" && payload.promptId) {
    const fallback = PROMPT_FALLBACKS[payload.promptId] ?? ""
    const currentContent = await loadPrompt(payload.promptId, fallback)
    log.debug("Prompt loaded for evolution", {
      promptId: payload.promptId,
      usedFallback: currentContent === fallback,
      contentLength: currentContent.length
    })
    const metrics = await collectMetrics()
    const recentOutputs = await getRecentResponses()

    const proposal = await proposePromptChange(payload.promptId, currentContent, metrics, recentOutputs)

    if (!proposal.shouldChange) {
      log.info("No prompt change needed", { reasoning: proposal.reasoning })
      return { action: "denied", reasoning: proposal.reasoning }
    }

    if (!proposal.autonomous && !payload.actionRequested) {
      log.info("Prompt change requires approval", { changelog: proposal.changelog })
      return { action: "pending", proposal }
    }

    if (!proposal.newPrompt) {
      log.warn("Prompt change approved but no new prompt content provided")
      return { action: "denied", reasoning: "No prompt content in proposal" }
    }

    const version = await applyPromptChange(payload.promptId, proposal.newPrompt, proposal.changelog)

    log.info("Prompt evolved", { promptId: payload.promptId, version })
    return { action: "applied", promptId: payload.promptId, version }
  }

  if (payload.type === "code") {
    return executeCodeEvolutionWithRetry(payload)
  }

  if (payload.type === "workflow" && payload.insight) {
    const recentTicks = await getRecentTickSummaries(50)
    const proposal = await proposeWorkflow(payload.insight, recentTicks)

    if (!proposal.shouldCreate) {
      log.info("No workflow creation needed", { reasoning: proposal.reasoning })
      return { action: "denied", reasoning: proposal.reasoning }
    }

    if (!proposal.autonomous && !payload.actionRequested) {
      log.info("Workflow creation requires approval", { name: proposal.name })
      return { action: "pending", proposal }
    }

    const idResult = await applyWorkflow(proposal)
    if (idResult.isErr()) {
      logAndCaptureError(idResult.error)
      return { action: "failed", reason: idResult.error.message }
    }
    const id = idResult.value
    log.info("Workflow created", { workflowId: id, name: proposal.name })
    return { action: "applied", workflowId: id }
  }

  log.warn("Invalid evolution payload", { payload })
  return { action: "invalid", reason: "Missing required fields" }
}

async function executeCodeEvolutionWithRetry(payload: EvolutionPayload): Promise<EvolutionOutput> {
  if (payload.pendingProposal) {
    log.info("Executing previously approved code proposal", { commitSubject: payload.pendingProposal.commitSubject })
    return attemptCodeEvolution(payload, payload.pendingProposal, MAX_EVOLUTION_RETRIES)
  }

  if (!payload.insight || !payload.capabilityGap) {
    log.warn("Invalid evolution payload", { payload })
    return { action: "invalid", reason: "Missing required fields" }
  }

  const proposal = await proposeCodeChange(payload.insight, payload.capabilityGap)

  if (!proposal.shouldEvolve) {
    if (proposal.failed) {
      log.warn("Code proposal failed", { reasoning: proposal.reasoning })
      return { action: "failed", result: { success: false, error: proposal.reasoning } }
    }
    log.info("No code change needed", { reasoning: proposal.reasoning })
    return { action: "denied", reasoning: proposal.reasoning }
  }

  if (!proposal.autonomous && !payload.actionRequested) {
    log.info("Code change requires approval")
    return { action: "pending", proposal, commitSubject: proposal.commitSubject }
  }

  return attemptCodeEvolution(payload, proposal, MAX_EVOLUTION_RETRIES)
}

async function attemptCodeEvolution(
  payload: EvolutionPayload,
  proposal: CodeProposal,
  remainingRetries: number
): Promise<EvolutionOutput> {
  const result = await executeCodeEvolution(proposal)

  if (result.success) {
    log.info("Code evolution succeeded", { commitSubject: proposal.commitSubject })
    return { action: "applied", result, commitSubject: proposal.commitSubject }
  }

  if (remainingRetries <= 0 || !payload.insight || !payload.capabilityGap) {
    captureError(new Error("Code evolution failed after retries"), {
      phase: "code_evolution",
      insight: payload.insight,
      capabilityGap: payload.capabilityGap,
      result
    })
    log.warn("Code evolution failed, no retries remaining", {
      error: result.error,
      insight: payload.insight,
      capabilityGap: payload.capabilityGap,
      commitSubject: proposal.commitSubject
    })
    return { action: "failed", result, commitSubject: proposal.commitSubject }
  }

  log.info("Code evolution failed, retrying with error feedback", {
    error: result.error,
    attempt: MAX_EVOLUTION_RETRIES - remainingRetries + 1,
    maxRetries: MAX_EVOLUTION_RETRIES,
    commitSubject: proposal.commitSubject
  })

  const attempt: PreviousAttempt = {
    error: result.error ?? "unknown error",
    sandboxStderr: result.sandboxStderr ?? ""
  }

  const retryProposal = await proposeCodeChange(payload.insight, payload.capabilityGap, attempt)

  if (!retryProposal.shouldEvolve) {
    log.info("Retry proposal declined to evolve", { reasoning: retryProposal.reasoning })
    return { action: "failed", result, commitSubject: proposal.commitSubject }
  }

  return attemptCodeEvolution(payload, retryProposal, remainingRetries - 1)
}

async function storeOutcome(outcome: EvolutionCycleResult): Promise<void> {
  if (outcome.action === "error") return

  const stored: EvolutionCycleResult = {
    action: outcome.action,
    commitSubject: outcome.commitSubject,
    insight: outcome.insight,
    capabilityGap: outcome.capabilityGap,
    error: outcome.error,
    timestamp: nowISO()
  }
  await setEvolutionCycleResult(stored)
  log.debug("Evolution outcome stored", { action: outcome.action, commitSubject: outcome.commitSubject })
}
