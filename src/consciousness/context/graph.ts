import type { EntityRelationSelect, EntitySelect } from "@/infra/db/schema.ts"
import { GRAPH_CONSTANTS } from "@/memory/graph/types.ts"

interface EntityWithRelations {
  entity: EntitySelect
  outgoing: Array<{ relation: EntityRelationSelect; target: EntitySelect }>
  incoming: Array<{ relation: EntityRelationSelect; source: EntitySelect }>
}

function groupByType(entitiesWithRels: EntityWithRelations[]): Map<string, EntityWithRelations[]> {
  const groups = new Map<string, EntityWithRelations[]>()
  for (const ewr of entitiesWithRels) {
    const type = ewr.entity.type
    const existing = groups.get(type) ?? []
    existing.push(ewr)
    groups.set(type, existing)
  }
  return groups
}

function formatEntityLine(ewr: EntityWithRelations): string {
  const { entity, outgoing, incoming } = ewr
  const isFading = entity.salience < GRAPH_CONSTANTS.SALIENCE_FADING_THRESHOLD

  const attrs = entity.attributes as Record<string, unknown>
  const attrParts: string[] = []
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== null && value !== undefined && value !== "") {
      attrParts.push(`${key}: ${String(value)}`)
    }
  }
  const attrStr = attrParts.length > 0 ? ` — ${attrParts.join(", ")}` : ""

  const fadingMarker = isFading ? " (fading memory)" : ""
  const lines = [`  - ${entity.name}${fadingMarker}${attrStr}`]

  for (const { relation, target } of outgoing) {
    const strength = relation.strength > 0.7 ? "strong" : relation.strength > 0.4 ? "moderate" : "weak"
    const desc = relation.description ? ` (${relation.description})` : ""
    lines.push(`    → ${relation.relationType} ${target.name}${desc} [${strength}]`)
  }

  for (const { relation, source } of incoming) {
    const strength = relation.strength > 0.7 ? "strong" : relation.strength > 0.4 ? "moderate" : "weak"
    const desc = relation.description ? ` (${relation.description})` : ""
    lines.push(`    ← ${relation.relationType} from ${source.name}${desc} [${strength}]`)
  }

  return lines.join("\n")
}

const TYPE_LABELS: Record<string, string> = {
  person: "People",
  place: "Places",
  organization: "Organizations",
  event: "Events",
  concept: "Concepts",
  object: "Objects"
}

/**
 * Build a context section rendering the knowledge graph for the LLM prompt.
 */
export function buildGraphSection(allEntities: EntitySelect[], relations: EntityRelationSelect[]): string {
  if (allEntities.length === 0) return ""

  const entityMap = new Map(allEntities.map((e) => [e.id, e]))

  const enriched: EntityWithRelations[] = allEntities.map((entity) => {
    const outgoing: EntityWithRelations["outgoing"] = []
    for (const r of relations) {
      if (r.sourceEntityId !== entity.id) continue
      const target = entityMap.get(r.targetEntityId)
      if (target) outgoing.push({ relation: r, target })
    }

    const incoming: EntityWithRelations["incoming"] = []
    for (const r of relations) {
      if (r.targetEntityId !== entity.id) continue
      const source = entityMap.get(r.sourceEntityId)
      if (source) incoming.push({ relation: r, source })
    }

    return { entity, outgoing, incoming }
  })

  const groups = groupByType(enriched)
  const lines: string[] = ["# Knowledge Graph"]

  const typeOrder = ["person", "place", "organization", "event", "concept", "object"]
  for (const type of typeOrder) {
    const group = groups.get(type)
    if (!group || group.length === 0) continue

    lines.push(`## ${TYPE_LABELS[type] ?? type}`)
    for (const ewr of group) {
      lines.push(formatEntityLine(ewr))
    }
  }

  return lines.length > 1 ? lines.join("\n") : ""
}
