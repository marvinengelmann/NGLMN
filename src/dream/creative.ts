import { jsonrepair } from "jsonrepair"
import { logAndCaptureError } from "@/config/result-helpers.ts"
import { callClaude, SONNET } from "@/integrations/anthropic.ts"
import { log } from "@/lib/logger.ts"
import { queryRelated, storeEpisode } from "@/memory/episodic.ts"
import { createGoal } from "@/memory/goals.ts"
import { getKnowledge, storeKnowledge } from "@/memory/semantic.ts"
import type { SemanticCategory } from "@/memory/types.ts"
import { CREATIVE_CONNECTIONS_SYSTEM_PROMPT } from "@/prompts/dream.ts"

const DIVERSE_QUERIES = [
  "surprising discoveries and unexpected findings",
  "creative ideas and novel approaches",
  "relationships and social dynamics",
  "technical patterns and system behavior",
  "emotional peaks and meaningful moments",
  "failures that taught something valuable",
  "recurring themes across different contexts",
  "operator interests and curiosities",
  "environmental changes and new observations",
  "abstract concepts and philosophical thoughts"
]

const KNOWLEDGE_CATEGORIES: SemanticCategory[] = ["preference", "project", "contact", "knowledge", "insight"]

export async function findCreativeConnections(): Promise<{
  connectionsFound: number
  goalsCreated: number
  insightsStored: number
}> {
  const episodicResults = await Promise.all(DIVERSE_QUERIES.map((q) => queryRelated(q, 2)))

  const episodes = episodicResults
    .flat()
    .filter((r, i, arr) => arr.findIndex((x) => x.id === r.id) === i)
    .slice(0, 10)

  const semanticEntries: Array<Record<string, unknown>> = []
  for (const category of KNOWLEDGE_CATEGORIES) {
    const entriesResult = await getKnowledge(category)
    const entries = entriesResult.unwrapOr([])
    if (entries.length > 0) {
      semanticEntries.push(
        ...entries.slice(0, 2).map((e) => ({
          category: e.category,
          key: e.key,
          value: e.value
        }))
      )
    }
  }

  if (episodes.length === 0 && semanticEntries.length === 0) {
    return { connectionsFound: 0, goalsCreated: 0, insightsStored: 0 }
  }

  const input = {
    episodes: episodes.map((e) => ({
      id: e.id,
      score: e.score,
      metadata: e.metadata
    })),
    knowledge: semanticEntries.slice(0, 10)
  }

  const result = await callClaude({
    model: SONNET,
    system: CREATIVE_CONNECTIONS_SYSTEM_PROMPT,
    userMessage: JSON.stringify(input),
    maxTokens: 2048
  })

  if (result.isErr()) {
    log.warn("findCreativeConnections: callClaude failed", { error: result.error.message })
    return { connectionsFound: 0, goalsCreated: 0, insightsStored: 0 }
  }

  const parsed = JSON.parse(jsonrepair(result.value)) as {
    connections: Array<{
      sources: string[]
      insight: string
      confidence: number
      actionable: boolean
      suggestedGoal: string | null
    }>
  }

  let goalsCreated = 0
  let insightsStored = 0

  for (const conn of parsed.connections) {
    if (conn.confidence >= 0.5) {
      await storeEpisode(`Dream connection: ${conn.insight}`, "dream", { relevanceScore: conn.confidence })

      const knowledgeResult = await storeKnowledge(
        "insight",
        `creative-connection-${Date.now()}-${insightsStored}`,
        conn.insight,
        "dream",
        conn.confidence
      )
      if (knowledgeResult.isErr()) logAndCaptureError(knowledgeResult.error)
      insightsStored++
    }

    if (conn.actionable && conn.suggestedGoal) {
      const goalResult = await createGoal(
        conn.suggestedGoal,
        `Creative dream connection: ${conn.insight}`,
        "dream",
        conn.confidence * 0.5,
        { emotionalWeight: 0.7 }
      )
      if (goalResult.isErr()) {
        logAndCaptureError(goalResult.error)
      } else {
        goalsCreated++
      }
    }
  }

  return {
    connectionsFound: parsed.connections.length,
    goalsCreated,
    insightsStored
  }
}
