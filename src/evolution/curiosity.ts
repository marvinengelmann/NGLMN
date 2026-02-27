import * as z from "zod"
import { logAndCaptureError } from "@/config/result-helpers.ts"
import { callIntelligence, REASONING } from "@/core/intelligence.ts"
import type { EmotionalState } from "@/emotion/types.ts"
import { log } from "@/lib/logger.ts"
import { storeEpisode } from "@/memory/episodic.ts"
import { createGoal } from "@/memory/goals.ts"

export const InterestsOutput = z.object({
  interests: z.array(
    z.object({
      topic: z.string(),
      reason: z.string(),
      priority: z.number().min(0).max(1)
    })
  )
})
export type InterestsOutput = z.infer<typeof InterestsOutput>

const INTEREST_PROMPT = `You are ANIMA reflecting on what interests you and what you'd like to explore.
Given your current emotional state, recent experiences, and knowledge, suggest topics worth exploring.

Rules:
- Suggest 2-5 topics
- Topics should be relevant to your capabilities and growth
- Higher priority for topics that address knowledge gaps
- Be specific, not generic`

export function shouldExplore(emotion: EmotionalState): boolean {
  return emotion.curiosity > 0.6 && emotion.boredom > 0.5 && emotion.caution < 0.7
}

export async function generateInterests(
  emotion: EmotionalState,
  recentEpisodes: string[],
  semanticKnowledge: string[]
): Promise<Array<{ topic: string; reason: string; priority: number }>> {
  const responseResult = await callIntelligence({
    model: REASONING,
    system: INTEREST_PROMPT,
    userMessage: JSON.stringify({
      emotionalState: emotion,
      recentExperiences: recentEpisodes.slice(0, 10),
      knownTopics: semanticKnowledge.slice(0, 10)
    }),
    schema: InterestsOutput,
    maxTokens: 1024
  })

  if (responseResult.isErr()) {
    log.warn("Failed to generate interests", { error: responseResult.error.message })
    return []
  }

  return responseResult.value.interests
}

export async function createExplorationGoal(
  topic: string,
  reason: string,
  curiosityLevel: number = 0.5
): Promise<string> {
  const goalResult = await createGoal(`Explore: ${topic}`, reason, "curiosity", curiosityLevel * 0.7, {
    emotionalWeight: curiosityLevel
  })

  if (goalResult.isErr()) {
    logAndCaptureError(goalResult.error)
    return ""
  }

  await storeEpisode(`Curiosity sparked: interested in "${topic}" — ${reason}`, "observation", { relevanceScore: 0.7 })

  return goalResult.value
}
