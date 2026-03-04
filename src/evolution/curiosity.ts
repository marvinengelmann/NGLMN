import { callIntelligence } from "@/core/intelligence.ts"
import type { EmotionalState } from "@/emotion/types.ts"
import { InterestsOutput } from "@/evolution/types.ts"
import { log } from "@/lib/logger.ts"
import { logAndCaptureError } from "@/lib/result.ts"
import { storeEpisode } from "@/memory/episodic.ts"
import { createGoal } from "@/memory/goals.ts"
import { CURIOSITY_INTEREST_SYSTEM_PROMPT } from "@/prompts/evolution.ts"

export function shouldExplore(emotion: EmotionalState): boolean {
  return emotion.curiosity > 0.6 && emotion.boredom > 0.5 && emotion.caution < 0.7
}

export async function generateInterests(
  emotion: EmotionalState,
  recentEpisodes: string[],
  semanticKnowledge: string[]
): Promise<Array<{ topic: string; reason: string; priority: number }>> {
  const responseResult = await callIntelligence({
    system: CURIOSITY_INTEREST_SYSTEM_PROMPT,
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

  log.info("Curiosity interests generated", { count: responseResult.value.interests.length })
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

  log.info("Exploration goal created", { topic, goalId: goalResult.value, curiosityLevel })
  return goalResult.value
}
