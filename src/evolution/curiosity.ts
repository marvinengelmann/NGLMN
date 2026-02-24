import { logAndCaptureError } from "@/config/result-helpers.ts"
import type { EmotionalState } from "@/emotion/types.ts"
import { callClaude, SONNET } from "@/integrations/anthropic.ts"
import { log } from "@/lib/logger.ts"
import { storeEpisode } from "@/memory/episodic.ts"
import { createGoal } from "@/memory/goals.ts"

const INTEREST_PROMPT = `You are ANIMA reflecting on what interests you and what you'd like to explore.
Given your current emotional state, recent experiences, and knowledge, suggest topics worth exploring.

Output ONLY valid JSON:
{
  "interests": [
    {
      "topic": "descriptive topic name",
      "reason": "why this is interesting",
      "priority": 0.0-1.0
    }
  ]
}

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
  const responseResult = await callClaude({
    model: SONNET,
    system: INTEREST_PROMPT,
    userMessage: JSON.stringify({
      emotionalState: emotion,
      recentExperiences: recentEpisodes.slice(0, 10),
      knownTopics: semanticKnowledge.slice(0, 10)
    }),
    maxTokens: 1024
  })

  if (responseResult.isErr()) {
    log.warn("Failed to generate interests", { error: responseResult.error.message })
    return []
  }

  const parsed = JSON.parse(responseResult.value) as {
    interests: Array<{ topic: string; reason: string; priority: number }>
  }

  return parsed.interests
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
