import { task } from "@trigger.dev/sdk"
import { logAndCaptureError } from "@/config/result-helpers.ts"
import { getRecentTickSummaries } from "@/core/workflow-engine.ts"
import { collectMetrics } from "@/emotion/metrics-check.ts"
import type { EvolutionType } from "@/evolution/changelog.ts"
import { executeCodeEvolution, proposeCodeChange } from "@/evolution/code-evolution.ts"
import { applyPromptChange, proposePromptChange } from "@/evolution/prompt-evolution.ts"
import { loadPrompt } from "@/evolution/prompt-loader.ts"
import { applyWorkflow, proposeWorkflow } from "@/evolution/workflow-evolution.ts"
import { log } from "@/lib/logger.ts"
import { captureError } from "@/lib/sentry.ts"
import { getRecentResponses, setTaskActive } from "@/memory/working.ts"
import { RESPONDER_SYSTEM_PROMPT } from "@/prompts/responder.ts"
import { TRIAGE_SYSTEM_PROMPT } from "@/prompts/triage.ts"

const PROMPT_FALLBACKS: Record<string, string> = {
  triage: TRIAGE_SYSTEM_PROMPT,
  responder: RESPONDER_SYSTEM_PROMPT
}

export const evolutionTask = task({
  id: "evolution",
  queue: {
    concurrencyLimit: 1
  },
  run: async (payload: { type: EvolutionType; promptId?: string; insight?: string; capabilityGap?: string }) => {
    log.info("Starting evolution", { type: payload.type })
    await setTaskActive(true)

    try {
      if (payload.type === "prompt" && payload.promptId) {
        const fallback = PROMPT_FALLBACKS[payload.promptId] ?? ""
        const currentContent = await loadPrompt(payload.promptId, fallback)
        const metrics = await collectMetrics()
        const recentOutputs = await getRecentResponses()

        const proposal = await proposePromptChange(payload.promptId, currentContent, metrics, recentOutputs)

        if (!proposal.shouldChange) {
          log.info("No prompt change needed", { reasoning: proposal.reasoning })
          return { action: "skipped", reasoning: proposal.reasoning }
        }

        if (!proposal.autonomous) {
          log.info("Prompt change requires approval", { changelog: proposal.changelog })
          return { action: "pending_approval", proposal }
        }

        if (!proposal.newPrompt) {
          log.warn("Prompt change approved but no new prompt content provided")
          return { action: "skipped", reasoning: "No prompt content in proposal" }
        }

        const version = await applyPromptChange(payload.promptId, proposal.newPrompt, proposal.changelog)

        log.info("Prompt evolved", { promptId: payload.promptId, version })
        return { action: "applied", promptId: payload.promptId, version }
      }

      if (payload.type === "code" && payload.insight && payload.capabilityGap) {
        const proposal = await proposeCodeChange(payload.insight, payload.capabilityGap)

        if (!proposal.shouldEvolve) {
          log.info("No code change needed", { reasoning: proposal.reasoning })
          return { action: "skipped", reasoning: proposal.reasoning }
        }

        if (!proposal.autonomous) {
          log.info("Code change requires approval")
          return { action: "pending_approval", proposal }
        }

        const result = await executeCodeEvolution(proposal)
        if (!result.success) {
          captureError(new Error("Code evolution failed"), {
            phase: "code_evolution",
            insight: payload.insight,
            capabilityGap: payload.capabilityGap,
            result
          })
        }
        log.info("Code evolution result", result)
        return { action: result.success ? "applied" : "failed", result }
      }

      if (payload.type === "workflow" && payload.insight) {
        const recentTicks = await getRecentTickSummaries(50)
        const proposal = await proposeWorkflow(payload.insight, recentTicks)

        if (!proposal.shouldCreate) {
          log.info("No workflow creation needed", { reasoning: proposal.reasoning })
          return { action: "skipped", reasoning: proposal.reasoning }
        }

        if (!proposal.autonomous) {
          log.info("Workflow creation requires approval", { name: proposal.name })
          return { action: "pending_approval", proposal }
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
    } finally {
      await setTaskActive(false)
    }
  }
})
