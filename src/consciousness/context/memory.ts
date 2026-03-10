import type { EmotionalState } from "@/affect/emotion/types.ts"
import { HUMOR } from "@/consciousness/constants.ts"
import type { SenseData } from "@/consciousness/types.ts"
import { CONTEXT_LIMITS } from "@/infra/config/constants.ts"
import {
  queryHumorCallbacks,
  queryHumorMemories,
  queryRelated,
  type queryRelationshipHistory
} from "@/memory/episodic.ts"
import { getRelatedEntities } from "@/memory/semantic.ts"
import type { EpisodeMetadata } from "@/memory/types.ts"
import type { DistortedMemory } from "@/perception/distortion/types.ts"

function formatKnowledgeByScope(knowledge: { category: string; key: string; value: unknown; scope: string }[]): string {
  const grouped: { self: string[]; operator: string[]; world: string[] } = { self: [], operator: [], world: [] }

  knowledge.forEach((k) => {
    const line = `  - [${k.category}] ${k.key}: ${JSON.stringify(k.value)}`
    const bucket = grouped[k.scope as keyof typeof grouped] ?? grouped.world
    bucket.push(line)
  })

  const lines: string[] = ["# Knowledge"]

  if (grouped.self && grouped.self.length > 0) {
    lines.push("## Self-Understanding")
    lines.push(...grouped.self)
  }
  if (grouped.operator && grouped.operator.length > 0) {
    lines.push("## About Operator")
    lines.push(...grouped.operator)
  }
  if (grouped.world && grouped.world.length > 0) {
    lines.push("## World")
    lines.push(...grouped.world)
  }

  return lines.length > 1 ? lines.join("\n") : ""
}

export async function buildMemorySections(
  episodes: DistortedMemory[],
  emotion: EmotionalState,
  senseData: SenseData,
  knowledge: { category: string; key: string; value: unknown; scope: string; confidence: number | null; id: string }[],
  relationships: Awaited<ReturnType<typeof queryRelationshipHistory>>
): Promise<string[]> {
  const sections: string[] = []

  if (episodes.length > 0) {
    sections.push(
      [
        `# Memory\nRelevant episodes (${episodes.length}):`,
        ...episodes
          .filter((ep): ep is typeof ep & { metadata: EpisodeMetadata } => ep.metadata !== undefined)
          .map((ep) => {
            const meta = ep.metadata
            const text = ep.data ? (ep.data.length > 150 ? `${ep.data.slice(0, 150)}...` : ep.data) : ""
            const textPart = text ? ` — ${text}` : ""
            const confidencePrefix = meta.confidenceNote
              ? `(${meta.confidenceNote}) `
              : meta.sourceConfused
                ? "(source unclear) "
                : ""
            return `  - ${confidencePrefix}[${meta.category}] ${meta.timestamp}${textPart}`
          })
      ].join("\n")
    )
  }

  const recentActivities = await queryRelated("recent activity", 5, "category = 'activity'")
  const activityEpisodes = recentActivities.filter((act) => act.metadata && !episodes.some((ep) => ep.id === act.id))

  if (activityEpisodes.length > 0) {
    sections.push(
      [
        "# Recent Activities",
        ...activityEpisodes
          .filter((ep): ep is typeof ep & { metadata: EpisodeMetadata } => ep.metadata !== undefined)
          .map((ep) => {
            const text = ep.data ? (ep.data.length > 150 ? `${ep.data.slice(0, 150)}...` : ep.data) : ""
            return `  - ${ep.metadata.timestamp} — ${text}`
          })
      ].join("\n")
    )
  }

  if (emotion.excitement > HUMOR.QUERY_MIN_EXCITEMENT || emotion.connection > HUMOR.QUERY_MIN_CONNECTION) {
    const humorEpisodes = await queryHumorMemories(HUMOR.MAX_EPISODES_IN_CONTEXT)

    let callbackEpisodes: typeof humorEpisodes = []
    if (senseData.pendingMessages.length > 0) {
      const currentContext = senseData.pendingMessages.map((m) => m.text).join(" ")
      callbackEpisodes = await queryHumorCallbacks(currentContext, HUMOR.CALLBACK_MAX, HUMOR.CALLBACK_MIN_SCORE)
    }

    const seen = new Set<string>()
    const allHumor = [...callbackEpisodes, ...humorEpisodes]
      .filter((ep) => {
        if (seen.has(ep.id)) return false
        seen.add(ep.id)
        return true
      })
      .slice(0, HUMOR.MAX_EPISODES_IN_CONTEXT)

    if (allHumor.length > 0) {
      sections.push(
        [
          "# Humor Memories",
          "Moments worth remembering with a smile:",
          ...allHumor
            .filter((ep) => ep.data)
            .map((ep) => {
              const tag = ep.metadata?.isInsideJoke ? " [inside joke]" : ""
              const data = ep.data ?? ""
              return `- ${data.length > 150 ? `${data.slice(0, 150)}...` : data}${tag}`
            }),
          "You may reference these when the moment feels right — especially inside jokes, as callbacks. Never force humor."
        ].join("\n")
      )
    }
  }

  if (knowledge.length > 0) {
    const sliced = knowledge.slice(0, CONTEXT_LIMITS.maxSemantic)
    const formatted = formatKnowledgeByScope(sliced)
    if (formatted) sections.push(formatted)

    const topEntries = sliced.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0)).slice(0, 5)
    const relatedResults = await Promise.all(topEntries.map((entry) => getRelatedEntities(entry.id)))
    const relationLines: string[] = []
    for (const [i, result] of relatedResults.entries()) {
      if (result.isErr()) continue
      const entry = topEntries[i]
      if (!entry) continue
      for (const rel of result.value.slice(0, 2)) {
        relationLines.push(`- "${entry.key}" → "${rel.key}"`)
      }
      if (relationLines.length >= 10) break
    }
    if (relationLines.length > 0) {
      sections.push(["# Knowledge Connections", ...relationLines].join("\n"))
    }
  } else {
    sections.push(
      "# Knowledge\nNo stored knowledge available. If asked about yourself and you don't have stored knowledge about it, be honest about not knowing yet rather than making something up. You can use the store_knowledge action to remember things you decide about yourself."
    )
  }

  if (relationships.length > 0) {
    sections.push(
      [
        `# Relationships\nRelationship history (${relationships.length}):`,
        ...relationships
          .filter((rel) => rel.metadata)
          .map((rel) => {
            const text = rel.data ? (rel.data.length > 150 ? `${rel.data.slice(0, 150)}...` : rel.data) : ""
            const textPart = text ? ` — ${text}` : ""
            return `  - ${rel.metadata?.timestamp}${textPart}`
          })
      ].join("\n")
    )
  }

  return sections
}
