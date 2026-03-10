import { log } from "@/infra/lib/logger.ts"
import { logAndCaptureError } from "@/infra/lib/result.ts"
import { queryRelated, storeEpisode } from "@/memory/episodic.ts"
import { createGoal } from "@/memory/goals.ts"
import { getKnowledge, storeKnowledge } from "@/memory/semantic.ts"
import { SemanticCategory, SemanticScope, SemanticSource } from "@/memory/types.ts"
import { addExistentialQuestion } from "@/self/psyche/questions.ts"
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
export interface CreativeData {
  episodes: { id: string | number; score: number; metadata: Record<string, unknown> | undefined }[]
  knowledge: { category: string; key: string; value: unknown }[]
}

/**
 * Gather diverse episodic and semantic data for creative dream connections.
 */
export async function gatherCreativeData(): Promise<CreativeData> {
  const episodicResults = await Promise.all(DIVERSE_QUERIES.map((q) => queryRelated(q, 2)))

  const episodes = episodicResults
    .flat()
    .filter((r, i, arr) => arr.findIndex((x) => x.id === r.id) === i)
    .slice(0, 10)

  const semanticResults = await Promise.all(KNOWLEDGE_CATEGORIES.map((cat) => getKnowledge({ category: cat })))
  const semanticEntries = semanticResults.flatMap((result) =>
    result
      .unwrapOr([])
      .slice(0, 2)
      .map((e) => ({ category: e.category, key: e.key, value: e.value }))
  )

  log.info("Creative dream material collected", {
    episodeCount: episodes.length,
    knowledgeCount: semanticEntries.length
  })

  return {
    episodes: episodes.map((e) => ({
      id: e.id,
      score: e.score,
      metadata: e.metadata
    })),
    knowledge: semanticEntries.slice(0, 10)
  }
}

/**
 * Apply creative connections output — pure ACT helper.
 * Persists episodes, knowledge entries, and goals from creative connections.
 */
export async function applyCreativeResult(output: CreativeConnectionsOutput): Promise<void> {
  const insightConnections = output.connections.filter((conn) => conn.confidence >= 0.5)
  await Promise.all(
    insightConnections.map(async (conn, i) => {
      await storeEpisode(`Dream connection: ${conn.insight}`, "dream", { relevanceScore: conn.confidence })
      const knowledgeResult = await storeKnowledge(
        SemanticCategory.enum.insight,
        `creative-connection-${Date.now()}-${i}`,
        conn.insight,
        SemanticSource.enum.dream,
        conn.confidence,
        SemanticScope.enum.self
      )
      if (knowledgeResult.isErr()) logAndCaptureError(knowledgeResult.error)
    })
  )

  const goalConnections = output.connections.filter((conn) => conn.actionable && conn.suggestedGoal)
  const goalResults = await Promise.all(
    goalConnections.map((conn) =>
      createGoal(
        conn.suggestedGoal ?? "",
        `Creative dream connection: ${conn.insight}`,
        "dream",
        conn.confidence * 0.5,
        {
          emotionalWeight: 0.7
        }
      )
    )
  )
  goalResults
    .filter((r) => r.isErr())
    .forEach((r) => {
      logAndCaptureError(r.error)
    })
  const goalsCreated = goalResults.filter((r) => r.isOk()).length

  const existentialCandidates = (output.existentialQuestions ?? []).slice(0, 2)
  await Promise.all(existentialCandidates.map((question) => addExistentialQuestion(question)))

  log.info("Creative connections applied", {
    connectionsProcessed: output.connections.length,
    goalsCreated,
    insightsStored: insightConnections.length,
    existentialQuestions: existentialCandidates.length
  })
}
