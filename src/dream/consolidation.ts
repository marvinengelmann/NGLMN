import { logAndCaptureError } from "@/config/result-helpers.ts"
import { callClaude, SONNET, stripCodeFences } from "@/integrations/anthropic.ts"
import { log } from "@/lib/logger.ts"
import { downgradeEpisodes, queryRelated, summarizeOldEpisodes } from "@/memory/episodic.ts"
import { storeKnowledge, storeRelation } from "@/memory/semantic.ts"
import { type RelationType, RelationType as RelationTypeSchema, type SemanticCategory } from "@/memory/types.ts"
import { CONSOLIDATION_SYSTEM_PROMPT } from "@/prompts/dream.ts"
import type { ConsolidationResult } from "./types.ts"

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

export async function consolidateMemories(): Promise<ConsolidationResult> {
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

  if (allEpisodes.length === 0) {
    return { episodesProcessed: 0, semanticEntriesCreated: 0, connectionsFound: 0, downgraded: 0 }
  }

  const episodesForPrompt = allEpisodes.slice(0, 50)

  const result = await callClaude({
    model: SONNET,
    system: CONSOLIDATION_SYSTEM_PROMPT,
    userMessage: JSON.stringify(episodesForPrompt),
    maxTokens: 2048
  })

  if (result.isErr()) {
    log.warn("consolidateMemories: callClaude failed", { error: result.error.message })
    return { episodesProcessed: 0, semanticEntriesCreated: 0, connectionsFound: 0, downgraded: 0 }
  }

  const parsed = JSON.parse(stripCodeFences(result.value)) as {
    semanticEntries: Array<{
      category: string
      key: string
      value: string
      confidence: number
    }>
    connections: Array<{
      episodeIds: string[]
      connectionType: string
      description: string
    }>
    downgradeIds: string[]
  }

  let semanticEntriesCreated = 0
  const createdEntryIds: string[] = []

  for (const entry of parsed.semanticEntries) {
    const category = VALID_CATEGORIES.includes(entry.category as SemanticCategory)
      ? (entry.category as SemanticCategory)
      : "knowledge"
    const entryIdResult = await storeKnowledge(category, entry.key, entry.value, "dream", entry.confidence)
    if (entryIdResult.isErr()) {
      logAndCaptureError(entryIdResult.error)
      continue
    }
    createdEntryIds.push(entryIdResult.value)
    semanticEntriesCreated++
  }

  const validRelationTypes = RelationTypeSchema.options
  for (const conn of parsed.connections) {
    if (createdEntryIds.length >= 2 && conn.episodeIds.length >= 2) {
      const relType = validRelationTypes.includes(conn.connectionType as RelationType)
        ? (conn.connectionType as RelationType)
        : "related_to"
      const sourceIdx = Math.min(0, createdEntryIds.length - 1)
      const targetIdx = Math.min(1, createdEntryIds.length - 1)
      const sourceEntryId = createdEntryIds[sourceIdx]
      const targetEntryId = createdEntryIds[targetIdx]
      if (sourceEntryId && targetEntryId && sourceIdx !== targetIdx) {
        const relationResult = await storeRelation(sourceEntryId, targetEntryId, relType, conn.description)
        if (relationResult.isErr()) logAndCaptureError(relationResult.error)
      }
    }
  }

  let downgraded = 0
  if (parsed.downgradeIds.length > 0) {
    downgraded = await downgradeEpisodes(parsed.downgradeIds)
  }

  const summarization = await summarizeOldEpisodes(7)

  return {
    episodesProcessed: episodesForPrompt.length,
    semanticEntriesCreated,
    connectionsFound: parsed.connections.length,
    downgraded,
    summarized: summarization.summarized
  }
}
