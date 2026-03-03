import { callIntelligence } from "@/core/intelligence.ts"
import { thinkDream } from "@/dream/thinking.ts"
import { log } from "@/lib/logger.ts"
import { captureError } from "@/lib/sentry.ts"
import { thinkMorning, thinkReflect } from "@/routine/thinking.ts"
import { AnimaDecision, type SenseResult, type ThinkResult } from "./types.ts"

/**
 * THINK phase — main LLM decision + sub-think dispatch based on action.
 */
export async function think(senseResult: SenseResult): Promise<ThinkResult> {
  const callResult = await callIntelligence({
    system: senseResult.systemPrompt,
    userMessage: senseResult.userPrompt,
    schema: AnimaDecision
  })

  if (callResult.isErr()) {
    captureError(callResult.error.cause, { phase: "think" })
    log.warn("Think LLM call failed, falling back to idle", { error: callResult.error.message })
    return {
      decision: {
        reasoning: "LLM call failed, defaulting to idle",
        messages: [],
        expectsReply: false,
        action: "idle",
        workflowId: null
      }
    }
  }

  const decision = callResult.value

  log.info("Think complete", {
    action: decision.action,
    messages: decision.messages.length,
    expectsReply: decision.expectsReply,
    reasoning: decision.reasoning
  })

  switch (decision.action) {
    case "dream":
      return { decision, dreamResult: await thinkDream() }
    case "morning":
      return { decision, morningResult: await thinkMorning(senseResult) }
    case "reflect":
      return { decision, reflectionResult: await thinkReflect(senseResult) }
    default:
      return { decision }
  }
}
