import { detectCognitiveConflict, shouldInstinctOverride } from "@/cognition/override.ts"
import { ATTENTION } from "@/config/constants.ts"
import { callIntelligence } from "@/core/intelligence.ts"
import { thinkDream } from "@/dream/thinking.ts"
import { log } from "@/lib/logger.ts"
import { captureError } from "@/lib/sentry.ts"
import { queryRelated } from "@/memory/episodic.ts"
import { getConsecutiveIdleTicks } from "@/memory/working.ts"
import { generateInnerDialog } from "@/polyphony/dialog.ts"
import { selectActiveVoices, shouldRunDialog } from "@/polyphony/voices.ts"
import { thinkMorning, thinkReflect } from "@/routine/thinking.ts"
import { generateBoredomImpulse } from "./boredom.ts"
import { buildContext, buildSystemPrompt } from "./context.ts"
import { AnimaDecision, type DeliberateResult, type FeelingResult, type SenseData, type SenseResult } from "./types.ts"

/**
 * DELIBERATE phase — main LLM decision with polyphony and instinct integration.
 */
export async function deliberate(senseResult: SenseResult, feelResult: FeelingResult): Promise<DeliberateResult> {
  const senseData: SenseData = {
    pendingMessages: senseResult.pendingMessages,
    perception: senseResult.perception,
    health: senseResult.health,
    weather: senseResult.perception.weatherData ?? null,
    conversationState: senseResult.conversationState,
    triggeredWorkflows: senseResult.triggeredWorkflows,
    moodContext: senseResult.moodContext
  }
  const contextString = await buildContext(senseData, feelResult.emotion)
  const systemPrompt = buildSystemPrompt(contextString)

  const activeVoices = selectActiveVoices(feelResult.emotion, {
    dissonanceScore: feelResult.dissonance.activeDissonance,
    action: "pending",
    hasMessages: senseResult.pendingMessages.length > 0
  })

  let innerDialog: DeliberateResult["innerDialog"]
  if (
    shouldRunDialog(
      feelResult.emotion,
      senseResult.pendingMessages.length > 0,
      feelResult.dissonance.activeDissonance,
      "pending"
    )
  ) {
    innerDialog =
      (await generateInnerDialog({
        activeVoices,
        emotion: feelResult.emotion,
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

    const action =
      feelResult.instinct.impulse === "avoid" || feelResult.instinct.impulse === "withdraw" ? "idle" : "reflect"
    const decision: AnimaDecision = {
      reasoning: `Instinct override: ${feelResult.instinct.basis}`,
      messages: [],
      expectsReply: false,
      action,
      workflowId: null,
      corrections: []
    }

    return {
      decision,
      systemPrompt,
      instinctOverride: true,
      innerDialog,
      cognitiveConflict: detectCognitiveConflict(feelResult.instinct, action)
    }
  }

  let userPrompt = "Process your current perception and decide what to do."

  if (feelResult.attentionState === "blank") {
    log.info("Attention blank — forcing idle")
    return {
      decision: {
        reasoning: "Mind is blank. No thoughts forming.",
        messages: [],
        expectsReply: false,
        action: "idle",
        workflowId: null,
        corrections: []
      },
      systemPrompt,
      instinctOverride: true,
      innerDialog
    }
  }

  if (feelResult.attentionState === "drifting" && Math.random() < ATTENTION.DRIFT_INJECTION_PROBABILITY) {
    const driftMemories = await queryRelated("random thought memory association", 1)
    if (driftMemories.length > 0 && driftMemories[0]?.data) {
      userPrompt = `${userPrompt}\n\n[A stray memory surfaces: "${driftMemories[0].data.slice(0, 200)}"]`
    }
  }

  const consecutiveIdle = await getConsecutiveIdleTicks()
  const boredomImpulse = generateBoredomImpulse(feelResult.emotion, consecutiveIdle)
  if (boredomImpulse) {
    userPrompt = `${userPrompt}\n\n[A spontaneous thought bubbles up: "${boredomImpulse}"]`
  }

  if (innerDialog?.utterances.length) {
    const dialogSection = [
      "\n## Inner Dialog",
      `Active voices: ${innerDialog.activeVoices.join(", ")}`,
      ...innerDialog.utterances.map((u) => `[${u.voice}]: ${u.message}`),
      ...(innerDialog.consensus ? [`Consensus: ${innerDialog.consensus}`] : []),
      ...(innerDialog.dominantVoice ? [`Dominant voice: ${innerDialog.dominantVoice}`] : []),
      ...(innerDialog.tensionLevel > 0.3 ? ["There's tension between these voices."] : []),
      "",
      "Consider the inner dialog. The consensus and dominant voice should inform your reasoning."
    ].join("\n")
    userPrompt = `${userPrompt}\n${dialogSection}`
  }

  const callResult = await callIntelligence({
    system: systemPrompt,
    userMessage: userPrompt,
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
        workflowId: null,
        corrections: []
      },
      systemPrompt,
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

  const base = { decision, systemPrompt, innerDialog, cognitiveConflict, instinctOverride: false as const }

  switch (decision.action) {
    case "dream":
      return { ...base, dreamResult: await thinkDream() }
    case "morning":
      return { ...base, morningResult: await thinkMorning(systemPrompt, feelResult.emotion, senseResult.moodContext) }
    case "reflect":
      return { ...base, reflectionResult: await thinkReflect(systemPrompt) }
    default:
      return base
  }
}
