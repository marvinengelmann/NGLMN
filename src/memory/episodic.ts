import { parseISO, subDays } from "date-fns"
import { callIntelligence, FAST, TextOutput } from "@/core/intelligence.ts"
import { vectorIndex } from "@/integrations/vector.ts"
import { log } from "@/lib/logger.ts"
import { nowISO } from "@/lib/time.ts"
import type { EpisodeMetadata, EpisodicCategory } from "@/memory/types.ts"

/**
 * Store an episode in Upstash Vector with auto-embedding.
 * We send only text via the `data` field — Upstash generates vectors automatically.
 */
export async function storeEpisode(
  summary: string,
  category: EpisodicCategory,
  metadata: {
    relevanceScore?: number
    emotionalState?: string
    tickId?: string
  } = {}
): Promise<string> {
  const id = crypto.randomUUID()
  const now = nowISO()

  await vectorIndex.upsert({
    id,
    data: summary,
    metadata: {
      category,
      timestamp: now,
      relevanceScore: metadata.relevanceScore ?? 0.5,
      emotionalState: metadata.emotionalState,
      tickId: metadata.tickId
    }
  })

  return id
}

/**
 * Query semantically related episodes using text-based search.
 * Upstash auto-embeds the query text and finds similar vectors.
 */
const MAX_QUERY_LENGTH = 5000

export async function queryRelated(
  text: string,
  topK: number = 5,
  filter?: string
): Promise<
  Array<{
    id: string
    score: number
    metadata: EpisodeMetadata | undefined
  }>
> {
  const truncated = text.length > MAX_QUERY_LENGTH ? text.slice(0, MAX_QUERY_LENGTH) : text
  const results = await vectorIndex.query({
    data: truncated,
    topK,
    includeMetadata: true,
    ...(filter ? { filter } : {})
  })

  return results.map((r) => ({
    id: r.id as string,
    score: r.score,
    metadata: r.metadata
  }))
}

/**
 * Store a relationship-related episode with high relevance.
 */
export async function storeRelationshipEpisode(
  summary: string,
  metadata: {
    emotionalState?: string
    tickId?: string
  } = {}
): Promise<string> {
  return storeEpisode(summary, "relationship", {
    relevanceScore: 0.85,
    ...metadata
  })
}

/**
 * Query relationship-specific episode history.
 */
export async function queryRelationshipHistory(topK: number = 5): Promise<
  Array<{
    id: string
    score: number
    metadata: EpisodeMetadata | undefined
  }>
> {
  return queryRelated("operator relationship interaction bonding", topK, "category = 'relationship'")
}

/**
 * Downgrade relevance scores for a list of episode IDs.
 * Used during dream consolidation to deprioritize stale or redundant episodes.
 */
export async function downgradeEpisodes(ids: string[], factor: number = 0.5): Promise<number> {
  let downgraded = 0

  for (const id of ids) {
    try {
      await vectorIndex.update<Partial<EpisodeMetadata>>({
        id,
        metadata: { relevanceScore: factor },
        metadataUpdateMode: "PATCH"
      })
      downgraded++
    } catch (e) {
      log.warn("Failed to downgrade episode", { id, error: String(e) })
    }
  }

  return downgraded
}

/**
 * Get recent episodes filtered by category.
 * Uses metadata filter + sorts by timestamp descending (via relevance to a generic query).
 */
/**
 * Summarize old low-relevance episodes into compact summary episodes.
 * Groups by category, summarizes via LLM, stores as new episodes, and downgrades originals.
 */
export async function summarizeOldEpisodes(
  daysThreshold: number = 7
): Promise<{ summarized: number; created: number }> {
  const categories: EpisodicCategory[] = ["interaction", "task", "observation", "dream", "evolution"]

  let totalSummarized = 0
  let totalCreated = 0

  for (const category of categories) {
    const results = await vectorIndex.query({
      data: `old ${category} episodes to summarize`,
      topK: 20,
      includeMetadata: true,
      includeData: true,
      filter: `category = '${category}'`
    })

    const cutoffDate = subDays(new Date(), daysThreshold)
    const oldLowRelevance = results.filter((r) => {
      const meta = r.metadata as EpisodeMetadata | undefined
      if (!meta) return false
      if ((meta.relevanceScore ?? 1) >= 0.6) return false
      try {
        return parseISO(meta.timestamp) < cutoffDate
      } catch (e) {
        log.warn("Failed to parse episode timestamp during summarization", {
          timestamp: meta.timestamp,
          error: String(e)
        })
        return false
      }
    })

    if (oldLowRelevance.length < 3) continue

    const episodeTexts = oldLowRelevance.map((r) => r.data ?? JSON.stringify(r.metadata)).join("\n---\n")

    const summaryResult = await callIntelligence({
      model: FAST,
      system:
        "Summarize these related episodes into 1-2 concise sentences capturing the key information. Be factual and brief.",
      userMessage: episodeTexts,
      schema: TextOutput,
      maxTokens: 200
    })

    if (summaryResult.isErr()) {
      log.warn("Episode summarization failed, skipping category", {
        category,
        episodeCount: oldLowRelevance.length,
        error: summaryResult.error.message
      })
      continue
    }
    const summary = summaryResult.value.text

    await storeEpisode(`[Summary] ${summary}`, category, {
      relevanceScore: 0.7
    })
    totalCreated++

    const idsToDowngrade = oldLowRelevance.map((r) => r.id as string)
    await downgradeEpisodes(idsToDowngrade, 0.1)
    totalSummarized += idsToDowngrade.length
  }

  return { summarized: totalSummarized, created: totalCreated }
}

export async function getRecentByCategory(
  category: EpisodicCategory,
  limit: number = 5
): Promise<
  Array<{
    id: string
    score: number
    metadata: EpisodeMetadata | undefined
  }>
> {
  const results = await vectorIndex.query({
    data: `recent ${category} activity`,
    topK: limit,
    includeMetadata: true,
    filter: `category = '${category}'`
  })

  return results.map((r) => ({
    id: r.id as string,
    score: r.score,
    metadata: r.metadata
  }))
}
