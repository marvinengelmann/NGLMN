import * as z from "zod"
import { callIntelligence } from "@/core/intelligence.ts"
import type { PendingMessage } from "@/integrations/types.ts"
import type { AnimaResultAsync } from "@/lib/result.ts"
import { trySafe } from "@/lib/result.ts"
import { EmotionTrigger, type EmotionUpdateEvent } from "./types.ts"

const MessageSentimentOutput = z.object({
  triggers: z.array(
    z.object({
      trigger: EmotionTrigger,
      intensity: z.number().min(0).max(1),
      detail: z.string().max(100)
    })
  ),
  dominantSentiment: z.enum(["positive", "negative", "neutral", "mixed"])
})

const SENTIMENT_SYSTEM_PROMPT = `You analyze emotional content of messages sent to an AI companion.
Return appropriate emotion triggers based on the message content.

Available triggers and when to use them:
- message_received: Generic message (use as baseline)
- operator_returned: Warm greeting after absence
- task_success: Praise, approval, positive feedback
- task_failure: Criticism, disappointment
- guardian_warning: Boundary-setting, mild correction
- new_goal: Requests, suggestions, ideas
- goal_completed: Celebrating achievements together

For each trigger, set intensity 0.0-1.0 based on emotional weight.
Return 1-3 triggers that best capture the emotional content.`

/**
 * Analyze the emotional content of incoming messages using an LLM.
 */
export function analyzeMessageSentiment(messages: PendingMessage[]): AnimaResultAsync<EmotionUpdateEvent[]> {
  return trySafe("LLM_ERROR", async () => {
    const messageTexts = messages.map((m) => `[${m.from}]: ${m.text}`).join("\n")

    const result = await callIntelligence({
      system: SENTIMENT_SYSTEM_PROMPT,
      userMessage: messageTexts,
      schema: MessageSentimentOutput,
      maxTokens: 512,
      reasoning: false
    })

    if (result.isErr()) {
      return [{ trigger: "message_received" as const, intensity: 0.6, detail: "sentiment analysis fallback" }]
    }

    return result.value.triggers.map((t) => ({
      trigger: t.trigger,
      intensity: t.intensity,
      detail: t.detail
    }))
  })
}
