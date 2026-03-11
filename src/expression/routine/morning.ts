import type { EmotionalState } from "@/affect/emotion/types.ts"
import { pushToActiveConversation } from "@/expression/communication/state.ts"
import { clearDreamInsights, clearDreamNarrative, getDreamNarrative, setDreamState } from "@/expression/dream/state.ts"
import { sendToOperator } from "@/infra/integrations/telegram.ts"
import { log } from "@/infra/lib/logger.ts"
import { captureError } from "@/infra/lib/sentry.ts"
import { nowISO } from "@/infra/lib/time.ts"
import { storeEpisode } from "@/memory/episodic.ts"
import { MORNING_MESSAGE_SYSTEM_PROMPT } from "@/prompts/routine.ts"

/**
 * Build the context for the morning message LLM call — pure THINK helper.
 * No LLM call, just data assembly for the prompt.
 */
export async function buildMorningContext(
  dreamInsights: string[] | null,
  emotion: EmotionalState,
  operatorLanguage: string
): Promise<{ systemInstruction: string; context: string }> {
  const dreamNarrative = await getDreamNarrative()
  const context = {
    operatorLanguage,
    dreamInsights: dreamInsights ?? [],
    dreamNarrative: dreamNarrative ?? undefined,
    currentMood: emotion
  }

  if (dreamNarrative) {
    await clearDreamNarrative()
  }

  return {
    systemInstruction: MORNING_MESSAGE_SYSTEM_PROMPT,
    context: JSON.stringify(context)
  }
}

/**
 * Send the morning message to operator — pure ACT helper.
 * Persists episode, pushes to conversation buffer, clears dream insights, resets dream state.
 */
export async function sendMorningMessage(message: string): Promise<void> {
  if (!message) {
    log.warn("sendMorningMessage: empty message, skipping send")
    await clearDreamInsights()
    await setDreamState("idle")
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
        timestamp: nowISO(),
        messageId: sentMessageId
      }
    ])
  } catch (e) {
    log.error("sendMorningMessage: failed to push to conversation buffer", { error: String(e) })
    captureError(e, { phase: "morning_conversation_buffer" })
  }

  await clearDreamInsights()
  await setDreamState("idle")
}
