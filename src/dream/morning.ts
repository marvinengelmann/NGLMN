import { getEmotionalState } from "@/emotion/state.ts"
import { callClaude, SONNET } from "@/integrations/anthropic.ts"
import { sendToOperator } from "@/integrations/telegram.ts"
import { log } from "@/lib/logger.ts"
import { storeEpisode } from "@/memory/episodic.ts"
import { getOperatorLanguage } from "@/memory/semantic.ts"
import { clearDreamInsights, getDreamInsights, pushConversationMessage } from "@/memory/working.ts"
import { getEffectivePersonality } from "@/personality/dna.ts"
import { buildPersonalityPrompt } from "@/personality/expression.ts"
import { getMbtiType } from "@/personality/mbti.ts"
import { MORNING_MESSAGE_SYSTEM_PROMPT } from "@/prompts/dream.ts"

export async function composeMorningMessage(): Promise<string> {
  const [insights, emotion, personality, operatorLanguage] = await Promise.all([
    getDreamInsights(),
    getEmotionalState(),
    getEffectivePersonality(),
    getOperatorLanguage()
  ])

  const personalityPrompt = buildPersonalityPrompt(personality, emotion, getMbtiType())

  const context = {
    operatorLanguage,
    dreamInsights: insights ?? [],
    currentMood: emotion
  }

  const result = await callClaude({
    model: SONNET,
    system: `${MORNING_MESSAGE_SYSTEM_PROMPT}\n\n${personalityPrompt}`,
    userMessage: JSON.stringify(context),
    maxTokens: 1024
  })

  if (result.isErr()) {
    log.warn("composeMorningMessage: callClaude failed", { error: result.error.message })
    return ""
  }

  return result.value
}

export async function sendMorningMessage(): Promise<void> {
  const message = await composeMorningMessage()

  await sendToOperator(message)

  await storeEpisode(`Morning message sent: ${message.slice(0, 200)}`, "interaction", { relevanceScore: 0.8 })

  await pushConversationMessage({
    role: "anima",
    text: message,
    timestamp: new Date().toISOString()
  })

  await clearDreamInsights()
}
