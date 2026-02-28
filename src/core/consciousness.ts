import { buildIdentityPrompt } from "@/core/identity.ts"
import type { EmotionalState } from "@/emotion/types.ts"
import { getEffectivePersonality } from "@/personality/dna.ts"
import { buildPersonalityPrompt } from "@/personality/expression.ts"

/**
 * Build the full consciousness prompt — combining identity, personality, and current emotional state
 * into a single coherent self-awareness block.
 */
export async function buildConsciousnessPrompt(emotion: EmotionalState): Promise<string> {
  const [identityPrompt, personality] = await Promise.all([buildIdentityPrompt(), getEffectivePersonality()])
  return `${identityPrompt}\n\n${buildPersonalityPrompt(personality, emotion)}`
}
