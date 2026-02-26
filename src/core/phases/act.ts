import { formatISO } from "date-fns"
import { jsonrepair } from "jsonrepair"
import * as z from "zod"
import { EMOTIONAL_THRESHOLDS, X } from "@/config/constants.ts"
import { hasXConfig } from "@/config/env.ts"
import { logAndCaptureError, trySafe } from "@/config/result-helpers.ts"
import { buildComplexContext, buildDeepContext, buildSimpleContext } from "@/core/context-builder.ts"
import { getMaxTokensForTier, selectModel } from "@/core/model-router.ts"
import type { TriageResult } from "@/core/types.ts"
import { executeWorkflow } from "@/core/workflow-engine.ts"
import { saveEmotionalState } from "@/emotion/state.ts"
import { computeEmotionalUpdate } from "@/emotion/update.ts"
import { loadPrompt } from "@/evolution/prompt-loader.ts"
import { callClaudeWithUsage } from "@/integrations/anthropic.ts"
import {
  escapeTelegramMarkdown,
  sendGuardianAlert,
  sendSystemNotification,
  sendToOperator
} from "@/integrations/telegram.ts"
import { log } from "@/lib/logger.ts"
import { setTickContext } from "@/lib/sentry.ts"
import { storeEpisode, storeRelationshipEpisode } from "@/memory/episodic.ts"
import { updateGoalStatus } from "@/memory/goals.ts"
import { GoalStatus } from "@/memory/types.ts"
import {
  pushRecentResponse,
  pushToActiveConversation,
  setGuardianResult,
  setLastProactiveAction
} from "@/memory/working.ts"
import { PROACTIVE_SYSTEM_PROMPT } from "@/prompts/proactive.ts"
import { validateOutput, validatePublicOutput } from "@/security/guardian.ts"
import type { SenseResult, TickContext } from "./sense.ts"
import type { ThinkResult } from "./think.ts"

export const ProactiveAction = z.enum(["message_operator", "reflect", "update_goal", "post_tweet", "nothing"])
export type ProactiveAction = z.infer<typeof ProactiveAction>

export const ProactiveResult = z.object({
  action: ProactiveAction,
  content: z.string().optional(),
  goalId: z.string().optional(),
  goalStatus: z.enum(["active", "paused", "done", "failed"]).optional()
})
export type ProactiveResult = z.infer<typeof ProactiveResult>

export interface ActResult {
  responseSent: boolean
  responseText?: string
  modelUsed?: string
}

async function handleIdleTick(senseResult: SenseResult, ctx: TickContext): Promise<ActResult> {
  const idleEmotion = computeEmotionalUpdate(senseResult.emotion, [
    { trigger: "idle_tick", intensity: EMOTIONAL_THRESHOLDS.IDLE_TICK_INTENSITY }
  ])
  await saveEmotionalState(idleEmotion, "idle_tick", ctx.tickId)
  return { responseSent: false }
}

async function handleMessageOperator(
  content: string,
  guardianValidate: typeof validateOutput,
  model: string,
  tier: string
): Promise<{ responseSent: boolean; responseText?: string }> {
  const guardianResult = await guardianValidate(content)
  await setGuardianResult(guardianResult)

  if (guardianResult.verdict === "blocked") {
    log.warn("Guardian BLOCKED proactive message", { reasons: guardianResult.reasons })
    await sendGuardianAlert(guardianResult)
    return { responseSent: false }
  }

  if (guardianResult.verdict === "warning") {
    await sendGuardianAlert(guardianResult)
  }

  await sendToOperator(content)
  await pushRecentResponse(content)
  await pushToActiveConversation([
    {
      role: "anima",
      text: content,
      timestamp: formatISO(new Date())
    }
  ])

  log.info("Proactive message sent to operator", { model, tier })
  return { responseSent: true, responseText: content }
}

async function handleReflect(content: string, tickId: string): Promise<void> {
  await storeEpisode(content, "observation", {
    relevanceScore: EMOTIONAL_THRESHOLDS.RELEVANCE_OBSERVATION,
    tickId
  })
  log.info("Proactive reflection stored", { contentLength: content.length })
}

async function handleGoalUpdate(goalId: string, goalStatus: string): Promise<void> {
  const parsed = GoalStatus.safeParse(goalStatus)
  if (!parsed.success) {
    log.warn("Invalid goal status from LLM, ignoring", { goalId, goalStatus })
    return
  }
  await updateGoalStatus(goalId, parsed.data)
  log.info("Goal status updated proactively", { goalId, status: goalStatus })
}

async function handlePostTweet(
  content: string,
  model: string,
  tier: string,
  actionRequested = false
): Promise<{ responseSent: boolean; responseText?: string }> {
  if (!hasXConfig()) {
    log.warn("Post tweet skipped — X not configured")
    await sendSystemNotification("X is not configured. Post could not be sent.")
    return { responseSent: false }
  }

  const { getXDailyTweetCount, incrementXDailyTweetCount } = await import("@/memory/working.ts")
  const dailyCount = await getXDailyTweetCount()
  if (dailyCount >= X.MAX_DAILY_PROACTIVE_TWEETS && !actionRequested) {
    log.info("Post tweet skipped — daily limit reached", { dailyCount })
    return { responseSent: false }
  }

  if (!actionRequested) {
    const { canActAutonomously } = await import("@/trust/assessment.ts")
    const trust = await canActAutonomously("x_post")
    if (!trust.canAct) {
      log.warn("Trust gate blocked proactive tweet", { reason: trust.reason })
      await sendSystemNotification("Trust level too low for autonomous X post.")
      return { responseSent: false }
    }
  }

  const guardianResult = await validatePublicOutput(content)
  await setGuardianResult(guardianResult)

  if (guardianResult.verdict === "blocked") {
    log.warn("Guardian BLOCKED proactive tweet", { reasons: guardianResult.reasons })
    await sendGuardianAlert(guardianResult)
    return { responseSent: false }
  }

  if (guardianResult.verdict === "warning") {
    await sendGuardianAlert(guardianResult)
  }

  const { postTweet } = await import("@/integrations/x.ts")
  const tweetId = await postTweet(content)
  if (!tweetId) {
    return { responseSent: false }
  }

  await incrementXDailyTweetCount()

  const { recordSuccess } = await import("@/trust/history.ts")
  await recordSuccess("x_post")

  const safePreview = escapeTelegramMarkdown(content.slice(0, 200))
  await sendToOperator(`\uD83D\uDC26 Proactive tweet posted\n\n${safePreview}`)

  log.info("Proactive tweet posted", { tweetId, model, tier })
  return { responseSent: true, responseText: content }
}

async function executeProactiveAction(
  proactiveResult: ProactiveResult,
  guardianValidate: typeof validateOutput,
  ctx: TickContext,
  model: string,
  tier: string,
  actionRequested = false
): Promise<{ responseSent: boolean; responseText?: string }> {
  let responseSent = false
  let responseText: string | undefined

  if (proactiveResult.action === "message_operator" && proactiveResult.content) {
    const result = await handleMessageOperator(proactiveResult.content, guardianValidate, model, tier)
    responseSent = result.responseSent
    responseText = result.responseText
  } else if (proactiveResult.action === "post_tweet" && proactiveResult.content) {
    const result = await handlePostTweet(proactiveResult.content, model, tier, actionRequested)
    responseSent = result.responseSent
    responseText = result.responseText
  } else if (proactiveResult.action === "reflect" && proactiveResult.content) {
    await handleReflect(proactiveResult.content, ctx.tickId)
  }

  if (proactiveResult.goalId && proactiveResult.goalStatus) {
    await handleGoalUpdate(proactiveResult.goalId, proactiveResult.goalStatus)
  }

  if (proactiveResult.action !== "nothing") {
    await setLastProactiveAction({
      action: proactiveResult.action,
      timestamp: formatISO(new Date())
    })
  }

  return { responseSent, responseText }
}

async function recordActOutcome(
  responseSent: boolean,
  triageResult: TriageResult,
  senseResult: SenseResult,
  ctx: TickContext
): Promise<void> {
  if (responseSent) {
    const outcomeEmotion = computeEmotionalUpdate(senseResult.emotion, [
      { trigger: "message_sent", intensity: EMOTIONAL_THRESHOLDS.MESSAGE_SENT_INTENSITY }
    ])
    await saveEmotionalState(outcomeEmotion, "message_sent", ctx.tickId)
  }

  const episodeSummary = responseSent
    ? `Proactive ${triageResult.decision}: ${triageResult.reason}`
    : `Tick ${triageResult.decision}: ${triageResult.reason}`

  if (responseSent && senseResult.emotion.connection > EMOTIONAL_THRESHOLDS.CONNECTION_HIGH) {
    await storeRelationshipEpisode(episodeSummary)
  } else {
    await storeEpisode(episodeSummary, responseSent ? "interaction" : "observation", {
      relevanceScore: triageResult.confidence,
      tickId: ctx.tickId
    })
  }
}

async function executeTriggeredWorkflows(workflows: ThinkResult["triggeredWorkflows"]): Promise<void> {
  for (const workflow of workflows) {
    const workflowResult = await trySafe("WORKFLOW_ERROR", () => executeWorkflow(workflow))

    workflowResult.match(
      (result) => {
        log.info("Workflow executed", { name: workflow.name, success: result.success })
      },
      (error) => {
        logAndCaptureError(error, { phase: "workflow_execution", workflowName: workflow.name })
      }
    )
  }
}

export async function act(ctx: TickContext, senseResult: SenseResult, thinkResult: ThinkResult): Promise<ActResult> {
  const { triageResult, personalityPrompt, triggeredWorkflows } = thinkResult

  await executeTriggeredWorkflows(triggeredWorkflows)

  if (triageResult.decision === "idle") {
    return handleIdleTick(senseResult, ctx)
  }

  const model = await selectModel(triageResult)
  setTickContext({ tickId: ctx.tickId, decision: triageResult.decision, tier: triageResult.decision, model })

  const tier = triageResult.decision as Exclude<typeof triageResult.decision, "idle">
  let contextPrompt: string
  switch (tier) {
    case "simple":
      contextPrompt = await buildSimpleContext([], personalityPrompt)
      break
    case "complex":
      contextPrompt = await buildComplexContext([], personalityPrompt)
      break
    case "deep":
      contextPrompt = await buildDeepContext([], personalityPrompt)
      break
    default: {
      const _exhaustive: never = tier
      contextPrompt = await buildSimpleContext([], personalityPrompt)
    }
  }

  const proactivePrompt = await loadPrompt("proactive", PROACTIVE_SYSTEM_PROMPT)
  const proactiveCallResult = await callClaudeWithUsage({
    model,
    system: proactivePrompt,
    userMessage: contextPrompt,
    maxTokens: getMaxTokensForTier(triageResult.decision)
  })

  if (proactiveCallResult.isErr()) {
    log.warn("Proactive call failed", { error: proactiveCallResult.error.message })
    return { responseSent: false }
  }
  const proactiveRaw = proactiveCallResult.value

  const proactiveParseResult = await trySafe("PARSE_ERROR", async () =>
    ProactiveResult.parse(JSON.parse(jsonrepair(proactiveRaw.text)))
  )

  if (proactiveParseResult.isErr()) {
    logAndCaptureError(proactiveParseResult.error, { phase: "proactive_parse", raw: proactiveRaw.text })
  }

  const proactiveResult = proactiveParseResult.unwrapOr({ action: "nothing" as const })

  log.info("Proactive action decided", { action: proactiveResult.action })

  const { responseSent, responseText } = await executeProactiveAction(
    proactiveResult,
    validateOutput,
    ctx,
    model,
    triageResult.decision,
    ctx.actionRequested
  )

  await recordActOutcome(responseSent, triageResult, senseResult, ctx)

  return { responseSent, responseText, modelUsed: model }
}
