import { buildConsciousnessPrompt } from "@/core/consciousness.ts"
import { callIntelligence, REASONING, TextOutput } from "@/core/intelligence.ts"
import { metricsRecalibration, morningRecalibration } from "@/emotion/calibration.ts"
import { collectMetrics } from "@/emotion/metrics.ts"
import { getEmotionalState, saveEmotionalState } from "@/emotion/state.ts"
import { sendToOperator } from "@/integrations/telegram.ts"
import { log } from "@/lib/logger.ts"
import { captureError } from "@/lib/sentry.ts"
import { storeEpisode } from "@/memory/episodic.ts"
import { getOperatorLanguage } from "@/memory/semantic.ts"
import { clearDreamInsights, getDreamInsights, pushToActiveConversation, setDreamState } from "@/memory/working.ts"
import { MORNING_MESSAGE_SYSTEM_PROMPT } from "@/prompts/dream.ts"
import { runReflection } from "./reflection.ts"

export interface MorningRoutineResult {
  action: string
  emotion: Record<string, number> | null
}

export async function composeMorningMessage(): Promise<string> {
  const [insights, emotion, operatorLanguage] = await Promise.all([
    getDreamInsights(),
    getEmotionalState(),
    getOperatorLanguage()
  ])

  const consciousnessPrompt = await buildConsciousnessPrompt(emotion)

  const context = {
    operatorLanguage,
    dreamInsights: insights ?? [],
    currentMood: emotion
  }

  const result = await callIntelligence({
    model: REASONING,
    system: `${MORNING_MESSAGE_SYSTEM_PROMPT}\n\n${consciousnessPrompt}`,
    userMessage: JSON.stringify(context),
    schema: TextOutput,
    maxTokens: 1024
  })

  if (result.isErr()) {
    log.warn("composeMorningMessage: callIntelligence failed", { error: result.error.message })
    return ""
  }

  return result.value.text
}

export async function sendMorningMessage(): Promise<void> {
  const message = await composeMorningMessage()

  if (!message) {
    log.warn("sendMorningMessage: empty message, skipping send")
    await clearDreamInsights()
    return
  }

  const sentMessageId = await sendToOperator(message)

  try {
    await storeEpisode(`Morning message sent: ${message.slice(0, 200)}`, "interaction", { relevanceScore: 0.8 })
  } catch (e) {
    log.error("sendMorningMessage: failed to store episode", { error: String(e) })
    captureError(e, { phase: "morning_episode" })
  }

  try {
    await pushToActiveConversation([
      {
        role: "anima",
        text: message,
        timestamp: new Date().toISOString(),
        messageId: sentMessageId
      }
    ])
  } catch (e) {
    log.error("sendMorningMessage: failed to push to conversation buffer", { error: String(e) })
    captureError(e, { phase: "morning_conversation_buffer" })
  }

  await clearDreamInsights()
}

/**
 * Full morning routine pipeline:
 * 1. Emotional recalibration (metrics-based + morning reset)
 * 2. Morning reflection
 * 3. Morning message to operator
 * 4. Reset dream state
 */
export async function runMorningRoutine(): Promise<MorningRoutineResult> {
  log.info("Starting morning routine")
  let emotion: Record<string, number> | null = null

  try {
    const [currentEmotion, metrics] = await Promise.all([getEmotionalState(), collectMetrics()])

    const afterMetrics = metricsRecalibration(currentEmotion, metrics)
    const afterMorning = morningRecalibration(afterMetrics)
    emotion = afterMorning

    await saveEmotionalState(afterMorning, "morning_calibration")
    log.info("Emotional recalibration complete", { before: currentEmotion, after: afterMorning })
  } catch (e) {
    log.error("Morning recalibration failed", { error: String(e) })
    captureError(e, { phase: "morning_recalibration" })
  }

  try {
    await runReflection("morning")
  } catch (e) {
    log.error("Morning reflection failed", { error: String(e) })
    captureError(e, { phase: "morning_reflection" })
  }

  try {
    await sendMorningMessage()
    log.info("Morning message sent")
  } catch (e) {
    log.error("Morning message failed", { error: String(e) })
    captureError(e, { phase: "morning_message" })
  } finally {
    await setDreamState("idle")
    log.info("Dream state reset to idle")
  }

  return { action: "completed", emotion }
}
