import { generateText, Output } from "ai"
import * as z from "zod"
import { MAX_OUTPUT_TOKENS } from "@/config/constants.ts"
import type { AnimaResultAsync } from "@/lib/result.ts"
import { trySafe } from "@/lib/result.ts"
import { estimateCallCost, trackApiCost } from "./budget.ts"

export const TextOutput = z.object({ text: z.string() })
export type TextOutput = z.infer<typeof TextOutput>

export const BooleanOutput = z.object({ result: z.boolean() })
export type BooleanOutput = z.infer<typeof BooleanOutput>

export const MODEL = "xai/grok-4-1-fast-reasoning"

interface CallIntelligenceOptions<T extends z.ZodType> {
  system: string
  userMessage: string
  schema: T
  maxTokens?: number
}

/**
 * Unified LLM call — uses generateText with Output.object for structured output.
 * Tracks usage internally; callers receive only the typed result.
 */
export function callIntelligence<T extends z.ZodType>(
  options: CallIntelligenceOptions<T>
): AnimaResultAsync<z.infer<T>> {
  return trySafe("LLM_ERROR", async () => {
    const result = await generateText({
      model: MODEL,
      system: options.system,
      prompt: options.userMessage,
      output: Output.object({ schema: options.schema }),
      maxOutputTokens: options.maxTokens ?? MAX_OUTPUT_TOKENS
    })

    const inputTokens = result.usage?.inputTokens ?? 0
    const outputTokens = result.usage?.outputTokens ?? 0

    const cost = estimateCallCost({ inputTokens, outputTokens })
    if (cost > 0) {
      await trackApiCost(cost)
    }

    return result.output as z.infer<T>
  })
}
