import { log } from "@/lib/logger.ts"
import { logAndCaptureError } from "@/lib/result.ts"
import { downgradeEpisodes, queryRelated, summarizeOldEpisodes } from "@/memory/episodic.ts"
import { storeKnowledge, storeRelation } from "@/memory/semantic.ts"
import {
  type RelationType,
  RelationType as RelationTypeSchema,
  SemanticCategory,
  SemanticScope,
  SemanticSource
} from "@/memory/types.ts"
import type { ConsolidationOutput } from "./types.ts"

const QUERY_TEXTS = [
  "recent interactions and conversations",
  "tasks completed and work done",
  "observations and environment changes",
  "goals progress and achievements",
  "errors failures and problems encountered",
  "creative ideas and insights",
  "emotional moments and reactions",
  "operator preferences and requests",
  "system performance and behavior",
  "learning and knowledge gained"
]

const VALID_CATEGORIES: SemanticCategory[] = ["preference", "project", "contact", "knowledge", "insight"]

/**
 * Gather episodic memory data for consolidation — pure SENSE helper.
 * Returns formatted episodes ready for the consolidation LLM prompt.
 */
export async function gatherConsolidationData(): Promise<string> {
  const allEpisodes: Array<{ id: string; score: number; text: string }> = []
  const seenIds = new Set<string>()

  const queryResults = await Promise.all(QUERY_TEXTS.map((text) => queryRelated(text, 10)))

  for (const results of queryResults) {
    for (const r of results) {
      if (!seenIds.has(r.id)) {
        seenIds.add(r.id)
        allEpisodes.push({
          id: r.id,
          score: r.score,
          text: JSON.stringify(r.metadata)
        })
      }
    }
  }

  log.info("Consolidation episodes collected", { uniqueEpisodes: allEpisodes.length })

  const episodesForPrompt = allEpisodes.slice(0, 50)
  return JSON.stringify(episodesForPrompt)
}

/**
 * Apply consolidation output — pure ACT helper.
 * Persists semantic entries, relations, downgrades, and summarization.
 */
export async function applyConsolidationResult(output: ConsolidationOutput): Promise<void> {
  const createdEntryIds: string[] = []

  for (const entry of output.semanticEntries) {
    const category = VALID_CATEGORIES.includes(entry.category as SemanticCategory)
      ? (entry.category as SemanticCategory)
      : SemanticCategory.enum.knowledge
    const entryIdResult = await storeKnowledge(
      category,
      entry.key,
      entry.value,
      SemanticSource.enum.dream,
      entry.confidence,
      SemanticScope.enum.self
    )
    if (entryIdResult.isErr()) {
      logAndCaptureError(entryIdResult.error)
      continue
    }
    createdEntryIds.push(entryIdResult.value)
  }

  const validRelationTypes = RelationTypeSchema.options
  const createdRelations = new Set<string>()
  for (const conn of output.connections) {
    const sourceEntryId = createdEntryIds[conn.sourceEntryIndex]
    const targetEntryId = createdEntryIds[conn.targetEntryIndex]
    if (!sourceEntryId || !targetEntryId || sourceEntryId === targetEntryId) continue
    const pairKey = [sourceEntryId, targetEntryId].sort().join(":")
    if (createdRelations.has(pairKey)) continue
    createdRelations.add(pairKey)
    const relType = validRelationTypes.includes(conn.connectionType as RelationType)
      ? (conn.connectionType as RelationType)
      : "related_to"
    const relationResult = await storeRelation(sourceEntryId, targetEntryId, relType, conn.description)
    if (relationResult.isErr()) logAndCaptureError(relationResult.error)
  }

  if (output.downgradeIds.length > 0) {
    await downgradeEpisodes(output.downgradeIds)
  }

  await summarizeOldEpisodes(7)

  log.info("Consolidation results applied", {
    semanticEntries: output.semanticEntries.length,
    connections: output.connections.length,
    downgrades: output.downgradeIds.length
  })
}
