import { generateText, Output } from "ai"
import type * as z from "zod"
import { MAX_OUTPUT_TOKENS } from "@/infra/config/constants.ts"
import type { AnimaResultAsync } from "@/infra/lib/result.ts"
import { trySafe } from "@/infra/lib/result.ts"
import { estimateCallCost, trackApiCost } from "./budget.ts"
import { FAST, REASONING, VISION } from "./providers.ts"

interface CallIntelligenceOptions<T extends z.ZodType> {
  system: string
  userMessage: string
  schema: T
  maxTokens?: number
  reasoning?: boolean
  images?: Array<{ base64: string; mimeType: string }>
  temperature?: number
}

/**
 * Unified LLM call — direct xAI provider with structured output.
 * Tracks usage internally; callers receive only the typed result.
 */
export function callIntelligence<T extends z.ZodType>(
  options: CallIntelligenceOptions<T>
): AnimaResultAsync<z.infer<T>> {
  return trySafe("LLM_ERROR", async () => {
    const hasImages = options.images && options.images.length > 0
    const model = hasImages ? VISION : options.reasoning === false ? FAST : REASONING

    const messageContent: Array<{ type: "text"; text: string } | { type: "image"; image: string; mimeType?: string }> =
      [
        { type: "text", text: options.userMessage },
        ...(options.images ?? []).map((img) => ({
          type: "image" as const,
          image: img.base64,
          mimeType: img.mimeType
        }))
      ]

    const result = await generateText({
      model,
      system: options.system,
      ...(hasImages
        ? { messages: [{ role: "user" as const, content: messageContent }] }
        : { prompt: options.userMessage }),
      output: Output.object({ schema: options.schema }),
      maxOutputTokens: options.maxTokens ?? MAX_OUTPUT_TOKENS,
      ...(options.temperature !== undefined && !hasImages ? { temperature: options.temperature } : {})
    })

    const inputTokens = result.usage?.inputTokens ?? 0
    const outputTokens = result.usage?.outputTokens ?? 0

    const cost = estimateCallCost({ inputTokens, outputTokens })
    if (cost > 0) {
      await trackApiCost(cost)
    }

    if (result.output == null) {
      throw new Error("LLM returned no structured output — schema mismatch or empty response")
    }
    return result.output as z.infer<T>
  })
}
