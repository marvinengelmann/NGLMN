import * as z from "zod"
import type { ConversationSlot } from "@/bridge/types.ts"
import { AFTERTHOUGHT } from "@/config/constants.ts"
import { callIntelligence, FAST } from "@/core/intelligence.ts"
import { log } from "@/lib/logger.ts"
import { AFTERTHOUGHT_SYSTEM_PROMPT } from "@/prompts/afterthought.ts"

const AfterthoughtResult = z.object({
  send: z.boolean(),
  text: z.string().optional(),
  replyTo: z.number().nullish()
})

/**
 * Check if ANIMA wants to add a spontaneous follow-up message after the main response.
 */
export async function checkForAfterthought(
  conversationBuffer: ConversationSlot[],
  personalityPrompt: string,
  operatorLanguage: string
): Promise<{ text: string; replyTo?: number } | null> {
  if (conversationBuffer.length === 0) return null

  const activeSlot = conversationBuffer[conversationBuffer.length - 1]
  if (!activeSlot || activeSlot.messages.length < 2) return null

  const lines: string[] = []
  lines.push(`Operator's preferred language: ${operatorLanguage}`)
  lines.push("")
  lines.push(personalityPrompt)
  lines.push("")
  lines.push("Conversation:")

  for (const msg of activeSlot.messages) {
    const role = msg.role === "operator" ? "Operator" : "You (ANIMA)"
    const idPrefix = msg.messageId ? `[#${msg.messageId}] ` : ""
    lines.push(`  ${idPrefix}[${role}]: ${msg.text}`)
  }

  const result = await callIntelligence({
    model: FAST,
    system: AFTERTHOUGHT_SYSTEM_PROMPT,
    userMessage: lines.join("\n"),
    schema: AfterthoughtResult,
    maxTokens: AFTERTHOUGHT.MAX_TOKENS
  })

  if (result.isErr()) {
    log.warn("Afterthought call failed", { error: result.error.message })
    return null
  }

  const parsed = result.value
  if (!parsed.send || !parsed.text) return null
  return { text: parsed.text, replyTo: parsed.replyTo ?? undefined }
}
