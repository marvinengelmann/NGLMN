import { db } from "@/infra/db/client.ts"
import { episodeLinks } from "@/infra/db/schema.ts"
import type { AnimaResultAsync } from "@/infra/lib/result.ts"
import { trySafe } from "@/infra/lib/result.ts"
import { wordOverlapRatio as computeWordOverlap } from "@/infra/lib/similarity.ts"
import type { EpisodeLinkType } from "./graph/types.ts"

export interface LinkedEpisodeRef {
  episodeId: string
  linkType: EpisodeLinkType
}

/**
 * Create a link between two episodes.
 */
export function createEpisodeLink(
  sourceEpisodeId: string,
  targetEpisodeId: string,
  linkType: EpisodeLinkType,
  description?: string
): AnimaResultAsync<string> {
  return trySafe("MEMORY_ERROR", async () => {
    const rows = await db
      .insert(episodeLinks)
      .values({ sourceEpisodeId, targetEpisodeId, linkType, description })
      .returning({ id: episodeLinks.id })

    const first = rows[0]
    if (!first) throw new Error("Expected row from episode link insert")
    return first.id
  })
}

/**
 * Get all episode IDs linked to any of the given episode IDs (1-hop, both directions).
 */
export function getLinkedEpisodeIds(episodeIds: string[]): AnimaResultAsync<LinkedEpisodeRef[]> {
  return trySafe("MEMORY_ERROR", async () => {
    if (episodeIds.length === 0) return []

    const allLinks = await db.select().from(episodeLinks)

    const episodeIdSet = new Set(episodeIds)
    const refs: LinkedEpisodeRef[] = []
    const seen = new Set<string>()

    for (const link of allLinks) {
      if (episodeIdSet.has(link.sourceEpisodeId) && !episodeIdSet.has(link.targetEpisodeId)) {
        if (!seen.has(link.targetEpisodeId)) {
          seen.add(link.targetEpisodeId)
          refs.push({ episodeId: link.targetEpisodeId, linkType: link.linkType as EpisodeLinkType })
        }
      }
      if (episodeIdSet.has(link.targetEpisodeId) && !episodeIdSet.has(link.sourceEpisodeId)) {
        if (!seen.has(link.sourceEpisodeId)) {
          seen.add(link.sourceEpisodeId)
          refs.push({ episodeId: link.sourceEpisodeId, linkType: link.linkType as EpisodeLinkType })
        }
      }
    }

    return refs
  })
}

/**
 * Detect potential causal links between recent consecutive episodes.
 * Uses a simple heuristic: if two consecutive episodes share significant word overlap, link them.
 */
export function detectAndLinkRelatedEpisodes(
  recentEpisodes: Array<{ id: string; data: string }>
): AnimaResultAsync<number> {
  return trySafe("MEMORY_ERROR", async () => {
    if (recentEpisodes.length < 2) return 0

    let linksCreated = 0

    for (const [index, current] of recentEpisodes.slice(0, -1).entries()) {
      const next = recentEpisodes[index + 1]
      if (!next) continue

      const similarity = computeWordOverlap(current.data, next.data)

      if (similarity > 0.3) {
        const linkResult = await createEpisodeLink(current.id, next.id, "continues")
        if (linkResult.isOk()) linksCreated++
      }
    }

    return linksCreated
  })
}
