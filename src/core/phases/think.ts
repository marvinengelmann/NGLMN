import { TRIAGE_DEFAULTS } from "@/config/constants.ts"
import { logAndCaptureError, trySafe } from "@/config/result-helpers.ts"
import { buildTriageContext } from "@/core/context-builder.ts"
import { getMaxTokensForTier, getModelForPhase } from "@/core/model-router.ts"
import type { WorkflowDefinition } from "@/core/types.ts"
import { TriageResult } from "@/core/types.ts"
import { checkWorkflowTriggers, getActiveWorkflows } from "@/core/workflow-engine.ts"
import { loadPrompt } from "@/evolution/prompt-loader.ts"
import { callClaude, stripCodeFences } from "@/integrations/anthropic.ts"
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

  const triageContext = await buildTriageContext()

  const triagePrompt = await loadPrompt("triage", TRIAGE_SYSTEM_PROMPT)
  const triageCallResult = await callClaude({
    model: getModelForPhase("triage"),
    system: triagePrompt,
    userMessage: triageContext.userPrompt,
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
  const triageRaw = triageCallResult.value

  const FALLBACK_TRIAGE: TriageResult = {
    decision: "idle",
    reason: "triage parse error",
    confidence: TRIAGE_DEFAULTS.FALLBACK_CONFIDENCE,
    estimatedTokens: TRIAGE_DEFAULTS.FALLBACK_ESTIMATED_TOKENS
  }

  const triageParseResult = await trySafe("PARSE_ERROR", async () =>
    TriageResult.parse(JSON.parse(stripCodeFences(triageRaw)))
  )

  if (triageParseResult.isErr()) {
    logAndCaptureError(triageParseResult.error, { phase: "triage_parse", raw: triageRaw })
  }

  const triageResult = triageParseResult.unwrapOr(FALLBACK_TRIAGE)

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
