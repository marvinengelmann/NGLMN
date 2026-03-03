import type { EmotionalState } from "@/emotion/types.ts"
import { sendToOperator } from "@/integrations/telegram.ts"
import { log } from "@/lib/logger.ts"
import { captureError } from "@/lib/sentry.ts"
import { storeEpisode } from "@/memory/episodic.ts"
import { clearDreamInsights, pushToActiveConversation, setDreamState } from "@/memory/working.ts"
import { MORNING_MESSAGE_SYSTEM_PROMPT } from "@/prompts/routine.ts"

/**
 * Build the context for the morning message LLM call — pure THINK helper.
 * No LLM call, just data assembly for the prompt.
 */
export function buildMorningContext(
  dreamInsights: string[] | null,
  emotion: EmotionalState,
  operatorLanguage: string
): { systemInstruction: string; context: string } {
  const context = {
    operatorLanguage,
    dreamInsights: dreamInsights ?? [],
    currentMood: emotion
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
        timestamp: new Date().toISOString(),
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
