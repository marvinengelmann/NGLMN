import { detectCognitiveConflict, shouldInstinctOverride } from "@/cognition/override.ts"
import { env } from "@/config/env.ts"
import { callIntelligence } from "@/core/intelligence.ts"
import { thinkDream } from "@/dream/thinking.ts"
import { log } from "@/lib/logger.ts"
import { captureError } from "@/lib/sentry.ts"
import type { PersonalityType } from "@/personality/types.ts"
import { generateInnerDialog } from "@/polyphony/dialog.ts"
import { selectActiveVoices, shouldRunDialog } from "@/polyphony/voices.ts"
import { thinkMorning, thinkReflect } from "@/routine/thinking.ts"
import { AnimaDecision, type DeliberateResult, type FeelingResult, type SenseResult } from "./types.ts"

/**
 * DELIBERATE phase — main LLM decision with polyphony and instinct integration.
 */
export async function deliberate(senseResult: SenseResult, feelResult: FeelingResult): Promise<DeliberateResult> {
  const personality = env().ANIMA_PERSONALITY_TYPE.substring(0, 4).toUpperCase() as PersonalityType

  const activeVoices = selectActiveVoices(senseResult.emotion, personality, {
    dissonanceScore: feelResult.dissonance.activeDissonance,
    action: "pending",
    hasMessages: senseResult.pendingMessages.length > 0
  })

  let innerDialog: DeliberateResult["innerDialog"]
  if (
    shouldRunDialog(
      senseResult.emotion,
      senseResult.pendingMessages.length > 0,
      feelResult.dissonance.activeDissonance,
      "pending"
    )
  ) {
    innerDialog =
      (await generateInnerDialog({
        activeVoices,
        emotion: senseResult.emotion,
        soma: feelResult.soma,
        situationSummary:
          senseResult.pendingMessages.length > 0
            ? `${senseResult.pendingMessages.length} new messages from operator`
            : "quiet tick, processing internal state",
        dissonanceScore: feelResult.dissonance.activeDissonance,
        instinctImpulse: feelResult.instinct.impulse
      })) ?? undefined
  }

  if (shouldInstinctOverride(feelResult.instinct, feelResult.soma)) {
    log.info("Instinct override triggered", { impulse: feelResult.instinct.impulse })

    const action = feelResult.instinct.impulse === "avoid" || feelResult.instinct.impulse === "withdraw" ? "idle" : "reflect"
    const decision: AnimaDecision = {
      reasoning: `Instinct override: ${feelResult.instinct.basis}`,
      messages: [],
      expectsReply: false,
      action,
      workflowId: null
    }

    return {
      decision,
      instinctOverride: true,
      innerDialog,
      cognitiveConflict: detectCognitiveConflict(feelResult.instinct, action)
    }
  }

  const callResult = await callIntelligence({
    system: senseResult.systemPrompt,
    userMessage: senseResult.userPrompt,
    schema: AnimaDecision
  })

  if (callResult.isErr()) {
    captureError(callResult.error.cause, { phase: "deliberate" })
    log.warn("Deliberate LLM call failed, falling back to idle", { error: callResult.error.message })
    return {
      decision: {
        reasoning: "LLM call failed, defaulting to idle",
        messages: [],
        expectsReply: false,
        action: "idle",
        workflowId: null
      },
      instinctOverride: false
    }
  }

  const decision = callResult.value

  log.info("Deliberate complete", {
    action: decision.action,
    messages: decision.messages.length,
    expectsReply: decision.expectsReply,
    reasoning: decision.reasoning
  })

  const cognitiveConflict = detectCognitiveConflict(feelResult.instinct, decision.action)

  const base = { decision, innerDialog, cognitiveConflict, instinctOverride: false as const }

  switch (decision.action) {
    case "dream":
      return { ...base, dreamResult: await thinkDream() }
    case "morning":
      return { ...base, morningResult: await thinkMorning(senseResult) }
    case "reflect":
      return { ...base, reflectionResult: await thinkReflect(senseResult) }
    default:
      return base
  }
}
