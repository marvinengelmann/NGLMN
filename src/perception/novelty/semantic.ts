import { vectorIndex } from "@/infra/integrations/vector.ts"
import { nowISO } from "@/infra/lib/time.ts"
import { NOVELTY } from "./constants.ts"
import { HABITUATION_NAMESPACE, type HabituationMetadata } from "./vector.ts"

const SIMILARITY_THRESHOLD = 0.85
const NS = { namespace: HABITUATION_NAMESPACE }

/**
 * Compute novelty using semantic similarity via Upstash Vector.
 * Uses the "habituation" namespace in the main vector index.
 */
export async function computeSemanticNovelty(stimulus: string): Promise<{ level: number; id: string }> {
  const results = await vectorIndex.query<HabituationMetadata>(
    {
      data: stimulus,
      topK: 1,
      includeMetadata: true
    },
    NS
  )

  const now = nowISO()
  const top = results[0]

  if (top && top.score > SIMILARITY_THRESHOLD && top.metadata) {
    const newCount = top.metadata.exposureCount + 1
    await vectorIndex.upsert<HabituationMetadata>(
      {
        id: top.id as string,
        data: stimulus,
        metadata: {
          exposureCount: newCount,
          firstSeenAt: top.metadata.firstSeenAt,
          lastSeenAt: now
        }
      },
      NS
    )

    const novelty = Math.max(0, 1 - newCount * NOVELTY.HABITUATION_DECAY_PER_EXPOSURE)
    return { level: novelty, id: top.id as string }
  }

  const id = crypto.randomUUID()
  await vectorIndex.upsert<HabituationMetadata>(
    {
      id,
      data: stimulus,
      metadata: {
        exposureCount: 1,
        firstSeenAt: now,
        lastSeenAt: now
      }
    },
    NS
  )

  await evictOldEntries()

  return { level: 1.0, id }
}

async function evictOldEntries(): Promise<void> {
  const info = await vectorIndex.info()
  const ns = info.namespaces[HABITUATION_NAMESPACE]
  if (!ns || ns.vectorCount <= NOVELTY.MAX_HABITUATION_ENTRIES) return

  const excessCount = ns.vectorCount - NOVELTY.MAX_HABITUATION_ENTRIES + 10
  const allEntries: Array<{ id: string; metadata?: HabituationMetadata }> = []
  let cursor: string | number = 0

  while (allEntries.length < ns.vectorCount) {
    const page: { nextCursor: string; vectors: Array<{ id: string | number; metadata?: HabituationMetadata }> } =
      await vectorIndex.range<HabituationMetadata>(
        {
          cursor,
          limit: 100,
          includeMetadata: true
        },
        NS
      )
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
    await vectorIndex.delete(
      toDelete.map((r) => r.id),
      NS
    )
  }
}
