import { TRIAGE_DEFAULTS } from "@/config/constants.ts"
import { logAndCaptureError, trySafe } from "@/config/result-helpers.ts"
import { buildTriageContext } from "@/core/context-builder.ts"
import { callIntelligence, FAST, getMaxTokensForTier } from "@/core/intelligence.ts"
import type { WorkflowDefinition } from "@/core/types.ts"
import { TriageResult } from "@/core/types.ts"
import { checkWorkflowTriggers, getActiveWorkflows } from "@/core/workflow-engine.ts"
import { loadPrompt } from "@/evolution/prompt-loader.ts"
import { log } from "@/lib/logger.ts"
import { addBreadcrumb, captureError, setTickContext } from "@/lib/sentry.ts"
import { getRecentTriageDecisions, pushRecentTriageDecision } from "@/memory/working.ts"
import { getEffectivePersonality } from "@/personality/dna.ts"
import { buildPersonalityPrompt } from "@/personality/expression.ts"
import { getMbtiType } from "@/personality/mbti.ts"
import { TRIAGE_SYSTEM_PROMPT } from "@/prompts/triage.ts"
import type { SenseResult, TickContext } from "./sense.ts"

export interface ThinkResult {
  triageResult: TriageResult
  personalityPrompt: string
  triggeredWorkflows: WorkflowDefinition[]
}

export async function think(ctx: TickContext, senseResult: SenseResult): Promise<ThinkResult> {
  const recentTriageDecisions = await getRecentTriageDecisions()

  const workflowResult = await trySafe("WORKFLOW_ERROR", async () => {
    const activeWorkflows = await getActiveWorkflows()
    return checkWorkflowTriggers(activeWorkflows, senseResult.emotion, senseResult.perception, recentTriageDecisions)
  })

  const triggeredWorkflows = workflowResult.unwrapOr([] as WorkflowDefinition[])
  if (workflowResult.isErr()) {
    logAndCaptureError(workflowResult.error, { phase: "workflows" })
  }

  const personality = await getEffectivePersonality()
  const personalityPrompt = buildPersonalityPrompt(personality, senseResult.emotion, getMbtiType())

  if (ctx.actionRequested) {
    log.info("Action requested by operator, skipping triage")
    const triageResult: TriageResult = {
      decision: "complex",
      reason: "operator requested action via conversation",
      confidence: 1.0,
      estimatedTokens: 500
    }
    await pushRecentTriageDecision(triageResult.decision)
    return { triageResult, personalityPrompt, triggeredWorkflows }
  }

  const triageContext = await buildTriageContext()

  const triagePrompt = await loadPrompt("triage", TRIAGE_SYSTEM_PROMPT)
  const triageCallResult = await callIntelligence({
    model: FAST,
    system: triagePrompt,
    userMessage: triageContext.userPrompt,
    schema: TriageResult,
    maxTokens: getMaxTokensForTier("triage")
  })

  if (triageCallResult.isErr()) {
    captureError(triageCallResult.error.cause, { phase: "triage_call" })
    log.warn("Triage call failed, falling back to idle", { error: triageCallResult.error.message })
    return {
      triageResult: {
        decision: "idle",
        reason: "triage call error",
        confidence: TRIAGE_DEFAULTS.FALLBACK_CONFIDENCE,
        estimatedTokens: TRIAGE_DEFAULTS.FALLBACK_ESTIMATED_TOKENS
      },
      personalityPrompt,
      triggeredWorkflows
    }
  }

  const triageResult = triageCallResult.value

  log.info("Triage complete", triageResult)
  addBreadcrumb("triage", `Decision: ${triageResult.decision}`, {
    decision: triageResult.decision,
    reason: triageResult.reason,
    confidence: triageResult.confidence
  })
  setTickContext({ tickId: ctx.tickId, decision: triageResult.decision, tier: triageResult.decision })

  await pushRecentTriageDecision(triageResult.decision)

  return { triageResult, personalityPrompt, triggeredWorkflows }
}
