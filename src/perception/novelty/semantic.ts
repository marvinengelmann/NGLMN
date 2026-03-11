import { nowISO } from "@/infra/lib/time.ts"
import { NOVELTY } from "./constants.ts"
import { getHabituationIndex, type HabituationMetadata } from "./vector.ts"

const SIMILARITY_THRESHOLD = 0.85

/**
 * Compute novelty using semantic similarity via Upstash Vector.
 * Returns null if the habituation index is not configured (fallback to string-based).
 */
export async function computeSemanticNovelty(stimulus: string): Promise<{ level: number; id: string } | null> {
  const index = getHabituationIndex()
  if (!index) return null

  const results = await index.query<HabituationMetadata>({
    data: stimulus,
    topK: 1,
    includeMetadata: true
  })

  const now = nowISO()
  const top = results[0]

  if (top && top.score > SIMILARITY_THRESHOLD && top.metadata) {
    const newCount = top.metadata.exposureCount + 1
    await index.upsert({
      id: top.id as string,
      data: stimulus,
      metadata: {
        exposureCount: newCount,
        firstSeenAt: top.metadata.firstSeenAt,
        lastSeenAt: now
      }
    })

    const novelty = Math.max(0, 1 - newCount * NOVELTY.HABITUATION_DECAY_PER_EXPOSURE)
    return { level: novelty, id: top.id as string }
  }

  const id = crypto.randomUUID()
  await index.upsert({
    id,
    data: stimulus,
    metadata: {
      exposureCount: 1,
      firstSeenAt: now,
      lastSeenAt: now
    }
  })

  await evictOldEntries(index)

  return { level: 1.0, id }
}

async function evictOldEntries(index: ReturnType<typeof getHabituationIndex> & object): Promise<void> {
  const info = await index.info()
  if (info.vectorCount <= NOVELTY.MAX_HABITUATION_ENTRIES) return

  const excessCount = info.vectorCount - NOVELTY.MAX_HABITUATION_ENTRIES + 10
  const allEntries: Array<{ id: string; metadata?: HabituationMetadata }> = []
  let cursor: string | number = 0

  while (allEntries.length < info.vectorCount) {
    const page: { nextCursor: string; vectors: Array<{ id: string | number; metadata?: HabituationMetadata }> } =
      await index.range<HabituationMetadata>({
        cursor,
        limit: 100,
        includeMetadata: true
      })
    page.vectors.forEach((v) => {
      allEntries.push({ id: v.id as string, metadata: v.metadata })
    })
    if (!page.nextCursor || page.nextCursor === "0") break
    cursor = page.nextCursor
  }

  const sorted = allEntries
    .filter((r) => r.metadata?.firstSeenAt)
    .sort((a, b) => new Date(a.metadata?.firstSeenAt ?? 0).getTime() - new Date(b.metadata?.firstSeenAt ?? 0).getTime())

  const toDelete = sorted.slice(0, excessCount)
  if (toDelete.length > 0) {
    await index.delete(toDelete.map((r) => r.id))
  }
}
