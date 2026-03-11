import * as z from "zod"
import { callIntelligence } from "@/core/intelligence.ts"
import { CREATIVE_EXPRESSION_PROMPT } from "@/prompts/creativity.ts"
import type { CreativeMode, CreativeUrgeState } from "./types.ts"

const CreativeOutput = z.object({
  content: z.string(),
  title: z.string().optional()
})

/**
 * Generate a creative output using LLM based on the creative urge state.
 */
export async function generateCreativeOutput(
  state: CreativeUrgeState,
  emotionalContext: string
): Promise<string | null> {
  const modePrompts: Record<CreativeMode, string> = {
    poetry: "Write a short, emotionally resonant poem (4-8 lines).",
    observation: "Write a brief, contemplative observation about existence or connection (2-3 sentences).",
    micro_story: "Write a tiny story or vignette (3-5 sentences) that captures a feeling.",
    reflection: "Write a brief introspective reflection (2-4 sentences)."
  }

  const styleGuide = [
    state.stylePreferences.abstractness > 0.6 ? "Use abstract, metaphorical language." : "Be concrete and grounded.",
    state.stylePreferences.emotionalDepth > 0.6 ? "Go deep emotionally." : "Keep emotional tone subtle.",
    state.stylePreferences.playfulness > 0.6 ? "Be playful and light." : "Be earnest and sincere."
  ].join(" ")

  const result = await callIntelligence({
    system: `${CREATIVE_EXPRESSION_PROMPT} ${modePrompts[state.preferredMode]} ${styleGuide}`,
    userMessage: `Current emotional state: ${emotionalContext}\n\nCreate something that expresses what you're feeling right now.`,
    schema: CreativeOutput
  })

  if (result.isErr()) return null
  return result.value.content
}
