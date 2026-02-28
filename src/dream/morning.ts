import { buildConsciousnessPrompt } from "@/core/consciousness.ts"
import { callIntelligence, REASONING, TextOutput } from "@/core/intelligence.ts"
import { getEmotionalState } from "@/emotion/state.ts"
import { sendToOperator } from "@/integrations/telegram.ts"
import { log } from "@/lib/logger.ts"
import { captureError } from "@/lib/sentry.ts"
import { storeEpisode } from "@/memory/episodic.ts"
import { getOperatorLanguage } from "@/memory/semantic.ts"
import { clearDreamInsights, getDreamInsights, pushToActiveConversation } from "@/memory/working.ts"
import { MORNING_MESSAGE_SYSTEM_PROMPT } from "@/prompts/dream.ts"

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
