import { getEmotionalState } from "@/affect/emotion/state.ts"
import { getNeuromodulatoryState } from "@/affect/neuromodulation/state.ts"
import { redis } from "@/infra/integrations/redis.ts"
import { log } from "@/infra/lib/logger.ts"
import { logAndCaptureError } from "@/infra/lib/result.ts"
import { storeWithConsistencyCheck } from "@/memory/consistency.ts"
import { downgradeEpisodes, forgetOldEpisodes, queryRelated, summarizeOldEpisodes } from "@/memory/episodic.ts"
import { processReconsolidation } from "@/memory/reconsolidation.ts"
import { storeRelation } from "@/memory/semantic.ts"
import {
  type RelationType,
  RelationType as RelationTypeSchema,
  SemanticCategory,
  SemanticScope,
  SemanticSource
} from "@/memory/types.ts"
import { DREAM_PHASES } from "./constants.ts"
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

  queryResults.flat().forEach((r) => {
    if (!seenIds.has(r.id)) {
      seenIds.add(r.id)
      allEpisodes.push({
        id: r.id,
        score: r.score,
        text: JSON.stringify(r.metadata)
      })
    }
  })

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

    const entryId = await storeWithConsistencyCheck(
      category,
      entry.key,
      entry.value,
      SemanticSource.enum.dream,
      entry.confidence,
      SemanticScope.enum.self
    )
    if (entryId) createdEntryIds.push(entryId)
  }

  const validRelationTypes = RelationTypeSchema.options
  const createdRelations = new Set<string>()
  await output.connections.reduce(async (previousPromise, conn) => {
    await previousPromise

    const sourceEntryId = createdEntryIds[conn.sourceEntryIndex]
    const targetEntryId = createdEntryIds[conn.targetEntryIndex]
    if (!sourceEntryId || !targetEntryId || sourceEntryId === targetEntryId) return
    const pairKey = [sourceEntryId, targetEntryId].sort().join(":")
    if (createdRelations.has(pairKey)) return
    createdRelations.add(pairKey)
    const relType = validRelationTypes.includes(conn.connectionType as RelationType)
      ? (conn.connectionType as RelationType)
      : "related_to"
    const relationResult = await storeRelation(sourceEntryId, targetEntryId, relType, conn.description)
    if (relationResult.isErr()) logAndCaptureError(relationResult.error)
  }, Promise.resolve())

  const consolidationEpisodes = await queryRelated("dream consolidation memory review", 10)
  if (consolidationEpisodes.length > 0) {
    const [dreamEmotion, dreamNeuro] = await Promise.all([getEmotionalState(), getNeuromodulatoryState()])
    await processReconsolidation(
      consolidationEpisodes,
      dreamEmotion,
      dreamNeuro,
      DREAM_PHASES.NREM_RECONSOLIDATION_MULTIPLIER
    )
  }

  if (output.downgradeIds.length > 0) {
    await downgradeEpisodes(output.downgradeIds)
  }

  const memoryPressure = await redis.get("working:memory:pressure")
  const summarizeDaysThreshold = memoryPressure ? 3 : 7
  await summarizeOldEpisodes(summarizeDaysThreshold)

  if (memoryPressure) {
    const forgotten = await forgetOldEpisodes(60, 0.3)
    log.info("Memory pressure: aggressive forgetting", { forgotten })
    await redis.del("working:memory:pressure")
  }

  log.info("Consolidation results applied", {
    semanticEntries: output.semanticEntries.length,
    connections: output.connections.length,
    downgrades: output.downgradeIds.length
  })
}
