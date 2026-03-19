import { differenceInDays, parseISO, subDays } from "date-fns"
import { callIntelligence } from "@/core/intelligence.ts"
import { TextOutput } from "@/core/types.ts"
import { vectorIndex } from "@/infra/integrations/vector.ts"
import { log } from "@/infra/lib/logger.ts"
import { extractErrorMessage } from "@/infra/lib/result.ts"
import { nowISO } from "@/infra/lib/time.ts"
import type { EpisodeMetadata, EpisodicCategory } from "@/memory/types.ts"
import { applyDistortions } from "@/perception/distortion/compute.ts"
import type { DistortedMemory } from "@/perception/distortion/types.ts"

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
    valence?: number
    isInsideJoke?: boolean
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
      tickId: metadata.tickId,
      valence: metadata.valence,
      isInsideJoke: metadata.isInsideJoke
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
    data: string | undefined
  }>
> {
  const truncated = text.length > MAX_QUERY_LENGTH ? text.slice(0, MAX_QUERY_LENGTH) : text
  const results = await vectorIndex.query({
    data: truncated,
    topK,
    includeMetadata: true,
    includeData: true,
    ...(filter ? { filter } : {})
  })

  return results.map((r) => ({
    id: r.id as string,
    score: r.score,
    metadata: r.metadata,
    data: r.data as string | undefined
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
    valence?: number
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
    data: string | undefined
  }>
> {
  return queryRelated("operator relationship interaction bonding", topK, "category = 'relationship'")
}

/**
 * Downgrade relevance scores for a list of episode IDs.
 * Used during dream consolidation to deprioritize stale or redundant episodes.
 */
export async function downgradeEpisodes(ids: string[], factor: number = 0.5): Promise<number> {
  const existing = await vectorIndex.fetch(ids, { includeMetadata: true })
  const currentScores = new Map<string, number>(
    existing.filter(Boolean).map((entry) => {
      const meta = entry?.metadata as EpisodeMetadata | undefined
      return [entry?.id as string, meta?.relevanceScore ?? 0.5]
    })
  )

  const results = await Promise.allSettled(
    ids.map((id) => {
      const currentScore = currentScores.get(id) ?? 0.5
      return vectorIndex.update<Partial<EpisodeMetadata>>({
        id,
        metadata: { relevanceScore: Math.max(0, currentScore * factor) },
        metadataUpdateMode: "PATCH"
      })
    })
  )
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      log.warn("Failed to downgrade episode", { id: ids[i], error: String(r.reason) })
    }
  })
  return results.filter((r) => r.status === "fulfilled").length
}

/**
 * Summarize old low-relevance episodes into compact summary episodes.
 * Groups by category, summarizes via LLM, stores as new episodes, and downgrades originals.
 */
export async function summarizeOldEpisodes(
  daysThreshold: number = 7
): Promise<{ summarized: number; created: number }> {
  const categories: EpisodicCategory[] = ["interaction", "task", "observation", "dream", "evolution", "activity"]

  const cutoffDate = subDays(new Date(), daysThreshold)

  const categoryResults = await Promise.all(
    categories.map(async (category) => {
      const results = await vectorIndex.query({
        data: `old ${category} episodes to summarize`,
        topK: 200,
        includeMetadata: true,
        includeData: true,
        filter: `category = '${category}'`
      })

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

      if (oldLowRelevance.length < 3) return { summarized: 0, created: 0 }

      const episodeTexts = oldLowRelevance.map((r) => r.data ?? JSON.stringify(r.metadata)).join("\n---\n")

      const summaryResult = await callIntelligence({
        system:
          "Summarize these related episodes into 1-2 concise sentences capturing the key information. Be factual and brief.",
        userMessage: episodeTexts,
        schema: TextOutput,
        maxTokens: 200,
        reasoning: false
      })

      if (summaryResult.isErr()) {
        log.warn("Episode summarization failed, skipping category", {
          category,
          episodeCount: oldLowRelevance.length,
          error: summaryResult.error.message
        })
        return { summarized: 0, created: 0 }
      }

      await storeEpisode(`[Summary] ${summaryResult.value.text}`, category, { relevanceScore: 0.7 })
      const idsToDowngrade = oldLowRelevance.map((r) => r.id as string)
      await downgradeEpisodes(idsToDowngrade, 0.1)

      return { summarized: idsToDowngrade.length, created: 1 }
    })
  )

  return categoryResults.reduce(
    (accumulator, result) => ({
      summarized: accumulator.summarized + result.summarized,
      created: accumulator.created + result.created
    }),
    { summarized: 0, created: 0 }
  )
}

/**
 * Store a humor episode with default high relevance.
 */
export async function storeHumorEpisode(
  summary: string,
  metadata?: { emotionalState?: string; tickId?: string; isInsideJoke?: boolean }
): Promise<string> {
  return storeEpisode(summary, "humor", {
    relevanceScore: 0.75,
    ...metadata
  })
}

/**
 * Query humor-related episodic memories.
 */
export async function queryHumorMemories(topK: number = 3): Promise<
  Array<{
    id: string
    score: number
    metadata: EpisodeMetadata | undefined
    data: string | undefined
  }>
> {
  return queryRelated("funny embarrassing absurd humorous moment", topK, "category = 'humor'")
}

export async function queryHumorCallbacks(
  currentContext: string,
  topK: number,
  minScore: number
): Promise<Array<{ id: string; score: number; metadata: EpisodeMetadata | undefined; data: string | undefined }>> {
  const results = await queryRelated(currentContext, topK + 2, "category = 'humor'")
  return results
    .filter((r) => r.score > minScore)
    .sort((a, b) => {
      const aInside = a.metadata?.isInsideJoke ? 1 : 0
      const bInside = b.metadata?.isInsideJoke ? 1 : 0
      return bInside !== aInside ? bInside - aInside : b.score - a.score
    })
    .slice(0, topK)
}

/**
 * Query related episodes with probabilistic memory distortion applied.
 */
export async function queryRelatedWithDistortion(
  text: string,
  topK: number,
  emotionIntensity: number,
  filter?: string,
  repressionMap?: Map<string, number>
): Promise<DistortedMemory[]> {
  const episodes = await queryRelated(text, topK, filter)
  let distorted = await applyDistortions(episodes, emotionIntensity)

  if (repressionMap && repressionMap.size > 0) {
    distorted = distorted.map((memory) => {
      const content = (memory.data ?? "").toLowerCase()
      let suppressionTotal = 0
      for (const [query, factor] of repressionMap) {
        if (content.includes(query.toLowerCase())) {
          suppressionTotal += factor
        }
      }
      if (suppressionTotal > 0) {
        return { ...memory, score: Math.max(0, memory.score * (1 - Math.min(1, suppressionTotal))) }
      }
      return memory
    })
  }

  return distorted
}

/**
 * Get recent episodes filtered by category.
 * Fetches a larger set with metadata filter, then sorts by timestamp descending client-side.
 */
export async function getRecentByCategory(
  category: EpisodicCategory,
  limit: number = 5
): Promise<
  Array<{
    id: string
    score: number
    metadata: EpisodeMetadata | undefined
    data: string | undefined
  }>
> {
  const fetchSize = Math.max(limit * 3, 20)
  const results = await vectorIndex.query({
    data: `${category} activity`,
    topK: fetchSize,
    includeMetadata: true,
    includeData: true,
    filter: `category = '${category}'`
  })

  const mapped = results.map((r) => ({
    id: r.id as string,
    score: r.score,
    metadata: r.metadata as EpisodeMetadata | undefined,
    data: r.data as string | undefined
  }))

  mapped.sort((a, b) => {
    const tsA = a.metadata?.timestamp ?? ""
    const tsB = b.metadata?.timestamp ?? ""
    return tsB.localeCompare(tsA)
  })

  return mapped.slice(0, limit)
}

/**
 * Delete old, low-relevance episodes to implement a forgetting curve.
 * Skips relationship and humor categories to preserve meaningful bonds.
 * Runs one query per category in parallel for efficiency.
 */
export async function forgetOldEpisodes(
  ageThresholdDays: number = 90,
  relevanceThreshold: number = 0.2
): Promise<number> {
  const categories: EpisodicCategory[] = ["interaction", "task", "observation", "dream", "evolution", "activity"]

  const categoryResults = await Promise.all(
    categories.map(async (category) => {
      const results = await vectorIndex.query({
        data: `old ${category} episodes`,
        topK: 200,
        includeMetadata: true,
        filter: `category = '${category}'`
      })

      return results
        .filter((r) => {
          const meta = r.metadata as EpisodeMetadata | undefined
          if (!meta) return false
          if ((meta.relevanceScore ?? 1) >= relevanceThreshold) return false
          try {
            return differenceInDays(new Date(), parseISO(meta.timestamp)) >= ageThresholdDays
          } catch (e) {
            log.warn("Failed to parse episode timestamp during forgetting", {
              id: r.id,
              timestamp: meta.timestamp,
              error: extractErrorMessage(e)
            })
            return false
          }
        })
        .map((r) => r.id as string)
    })
  )

  const deleteIds = categoryResults.flat()
  if (deleteIds.length > 0) {
    await vectorIndex.delete(deleteIds)
    log.info("Forgot old episodes", { count: deleteIds.length })
  }

  return deleteIds.length
}
