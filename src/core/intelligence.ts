import { generateObject } from "ai"
import * as z from "zod"
import type { TierKey } from "@/config/constants.ts"
import { MAX_TOKENS } from "@/config/constants.ts"
import type { AnimaResultAsync } from "@/config/result-helpers.ts"
import { trySafe } from "@/config/result-helpers.ts"
import type { TriageResult } from "@/core/types.ts"
import { estimateCallCost, trackApiCost } from "./budget.ts"

export const TextOutput = z.object({ text: z.string() })
export type TextOutput = z.infer<typeof TextOutput>

export const BooleanOutput = z.object({ result: z.boolean() })
export type BooleanOutput = z.infer<typeof BooleanOutput>

export const FAST = "xai/grok-4-1-fast-non-reasoning"
export const REASONING = "xai/grok-4-1-fast-reasoning"

/**
 * Select the appropriate model based on triage result.
 */
export function selectModel(triageResult: TriageResult): string {
  switch (triageResult.decision) {
    case "idle":
    case "simple":
      return FAST
    case "complex":
    case "deep":
      return REASONING
  }
}

/**
 * Get the max tokens allowed for each tier.
 */
export function getMaxTokensForTier(tier: TierKey): number {
  return MAX_TOKENS[tier]
}

interface CallIntelligenceOptions<T extends z.ZodType> {
  model: string
  system: string
  userMessage: string
  schema: T
  maxTokens?: number
}

/**
 * Unified LLM call — always uses generateObject with a Zod schema.
 * Tracks usage internally; callers receive only the typed result.
 */
export function callIntelligence<T extends z.ZodType>(opts: CallIntelligenceOptions<T>): AnimaResultAsync<z.infer<T>> {
  return trySafe("LLM_ERROR", async () => {
    const result = await generateObject({
      model: opts.model,
      system: opts.system,
      prompt: opts.userMessage,
      schema: opts.schema,
      maxTokens: opts.maxTokens ?? 1024
    })

    const inputTokens = result.usage?.inputTokens ?? 0
    const outputTokens = result.usage?.outputTokens ?? 0

    const cost = estimateCallCost(opts.model, { inputTokens, outputTokens })
    if (cost > 0) {
      await trackApiCost(cost)
    }

    return result.object as z.infer<T>
  })
}
