import Anthropic from "@anthropic-ai/sdk"
import * as z from "zod"
import type { AnimaResultAsync } from "@/config/result-helpers.ts"
import { trySafe } from "@/config/result-helpers.ts"
import { estimateCallCost, trackApiCost } from "@/core/budget.ts"

export const ClaudeModel = z.enum(["claude-haiku-4-5-20251001", "claude-sonnet-4-6", "claude-opus-4-6"])
export type ClaudeModel = z.infer<typeof ClaudeModel>
export const HAIKU = "claude-haiku-4-5-20251001" as const satisfies ClaudeModel
export const SONNET = "claude-sonnet-4-6" as const satisfies ClaudeModel
export const OPUS = "claude-opus-4-6" as const satisfies ClaudeModel

export interface SystemBlock {
  text: string
  cacheControl?: boolean
}

const client = new Anthropic()

interface CallClaudeOptions {
  model: ClaudeModel
  system: string | SystemBlock[]
  userMessage: string
  maxTokens?: number
}

export interface ClaudeResponse {
  text: string
  usage: {
    inputTokens: number
    outputTokens: number
    cacheReadTokens?: number
    cacheCreationTokens?: number
  }
}

/**
 * Build system blocks for the Anthropic API from string or SystemBlock array.
 */
function buildSystemBlocks(system: string | SystemBlock[]) {
  if (typeof system === "string") {
    return [
      {
        type: "text" as const,
        text: system,
        cache_control: { type: "ephemeral" as const }
      }
    ]
  }

  return system.map((block) => ({
    type: "text" as const,
    text: block.text,
    ...(block.cacheControl !== false ? { cache_control: { type: "ephemeral" as const } } : {})
  }))
}

/**
 * Send a message to Claude and return full response with usage data.
 */
export function callClaudeWithUsage({
  model,
  system,
  userMessage,
  maxTokens = 1024
}: CallClaudeOptions): AnimaResultAsync<ClaudeResponse> {
  return trySafe("ANTHROPIC_ERROR", async () => {
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: buildSystemBlocks(system),
      messages: [{ role: "user", content: userMessage }]
    })

    const textParts = response.content
      .filter((block): block is Anthropic.Messages.TextBlock => block.type === "text")
      .map((block) => block.text)

    if (textParts.length === 0) {
      throw new Error("No text blocks in response")
    }

    const lastText = textParts[textParts.length - 1]
    if (lastText === undefined) {
      throw new Error("No text blocks in response")
    }

    const usage = {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? undefined,
      cacheCreationTokens: response.usage.cache_creation_input_tokens ?? undefined
    }

    const cost = estimateCallCost(model, usage)
    if (cost > 0) {
      await trackApiCost(cost)
    }

    return { text: lastText, usage }
  })
}

/**
 * Send a message to Claude and return the text response.
 * @param options - Model, system prompt, user message, and optional max tokens.
 */
export function callClaude(options: CallClaudeOptions): AnimaResultAsync<string> {
  return callClaudeWithUsage(options).map((r) => r.text)
}

/**
 * Strip markdown code fences (```json ... ```) from a Claude response for safe JSON.parse.
 */
export function stripCodeFences(text: string): string {
  return text
    .replace(/```(?:json)?\s*/g, "")
    .replace(/```/g, "")
    .trim()
}
