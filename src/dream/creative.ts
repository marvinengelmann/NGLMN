import { log } from "@/lib/logger.ts"
import { logAndCaptureError } from "@/lib/result.ts"
import { queryRelated, storeEpisode } from "@/memory/episodic.ts"
import { createGoal } from "@/memory/goals.ts"
import { getKnowledge, storeKnowledge } from "@/memory/semantic.ts"
import { SemanticCategory, SemanticScope, SemanticSource } from "@/memory/types.ts"
import type { CreativeConnectionsOutput } from "./types.ts"

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

/**
 * Gather episodic and semantic data for creative connections — pure SENSE helper.
 * Returns formatted input ready for the creative connections LLM prompt.
 */
export async function gatherCreativeData(): Promise<string> {
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

  log.info("Creative dream material collected", {
    episodeCount: episodes.length,
    knowledgeCount: semanticEntries.length
  })

  const input = {
    episodes: episodes.map((e) => ({
      id: e.id,
      score: e.score,
      metadata: e.metadata
    })),
    knowledge: semanticEntries.slice(0, 10)
  }

  return JSON.stringify(input)
}

/**
 * Apply creative connections output — pure ACT helper.
 * Persists episodes, knowledge entries, and goals from creative connections.
 */
export async function applyCreativeResult(output: CreativeConnectionsOutput): Promise<void> {
  let goalsCreated = 0
  let insightsStored = 0

  for (const conn of output.connections) {
    if (conn.confidence >= 0.5) {
      await storeEpisode(`Dream connection: ${conn.insight}`, "dream", { relevanceScore: conn.confidence })

      const knowledgeResult = await storeKnowledge(
        SemanticCategory.enum.insight,
        `creative-connection-${Date.now()}-${insightsStored}`,
        conn.insight,
        SemanticSource.enum.dream,
        conn.confidence,
        SemanticScope.enum.self
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

  log.info("Creative connections applied", {
    connectionsProcessed: output.connections.length,
    goalsCreated,
    insightsStored
  })
}
