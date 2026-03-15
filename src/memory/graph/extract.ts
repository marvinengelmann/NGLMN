import { callIntelligence } from "@/core/intelligence.ts"
import { log } from "@/infra/lib/logger.ts"
import { getEntityByName, recordMention, upsertEntity, upsertRelation } from "./store.ts"
import { EntityExtractionOutput, type ExtractedEntity } from "./types.ts"

const OPERATOR_SENTINEL = "operator"

const EXTRACTION_SYSTEM_PROMPT = `You extract entities (people, places, organizations, events, concepts, objects) from conversations between an AI companion (ANIMA) and the operator.

Rules:
- Extract only entities that are meaningfully referenced, not passing mentions
- For people: capture name, relationship to operator if stated, occupation, location
- For dates (birthdays, deadlines, appointments): store as attributes in YYYY-MM-DD format, e.g. {"birthday": "1990-05-15"}
- For relations between entities: specify the relation type (e.g. "brother_of", "works_at", "lives_in", "friend_of")
- The "operator" is a special entity — do NOT extract them as an entity, but DO reference them in relations (use "operator" as targetName)
- Max 5 entities per extraction
- Use English for all entity names and relation types`

/**
 * Extract entities and relations from a conversation and persist them to the knowledge graph.
 */
export async function extractEntitiesFromConversation(
  messages: string[],
  animaResponse: string,
  tickId: string
): Promise<void> {
  const conversationText = [...messages, `ANIMA: ${animaResponse}`].filter(Boolean).join("\n")

  if (conversationText.trim().length < 20) return

  const result = await callIntelligence({
    system: EXTRACTION_SYSTEM_PROMPT,
    userMessage: `Extract entities from this conversation:\n\n${conversationText}`,
    schema: EntityExtractionOutput,
    reasoning: false,
    temperature: 0.1
  })

  if (result.isErr()) {
    log.debug("Entity extraction failed", { error: result.error.message })
    return
  }

  const extracted = result.value.entities
  if (extracted.length === 0) return

  const operatorId = await resolveOperatorEntityId()
  const entityIdMap = new Map<string, string>()
  if (operatorId) {
    entityIdMap.set(OPERATOR_SENTINEL, operatorId)
  }

  for (const entity of extracted) {
    await persistEntity(entity, tickId, conversationText, entityIdMap)
  }

  for (const entity of extracted) {
    await persistRelations(entity, entityIdMap)
  }

  log.debug("Entity extraction complete", {
    entitiesExtracted: extracted.length,
    entityNames: extracted.map((e) => e.name)
  })
}

async function resolveOperatorEntityId(): Promise<string | null> {
  const existing = await getEntityByName(OPERATOR_SENTINEL)
  if (existing.isOk() && existing.value) return existing.value.id

  const created = await upsertEntity(OPERATOR_SENTINEL, "person", { role: "operator" }, "observation")
  if (created.isOk()) return created.value
  return null
}

async function persistEntity(
  entity: ExtractedEntity,
  tickId: string,
  conversationContext: string,
  entityIdMap: Map<string, string>
): Promise<void> {
  const idResult = await upsertEntity(entity.name, entity.type, entity.attributes, "observation")
  if (idResult.isErr()) {
    log.debug("Failed to upsert entity", { name: entity.name, error: idResult.error.message })
    return
  }

  const entityId = idResult.value
  entityIdMap.set(entity.name.toLowerCase(), entityId)

  const contextSnippet = conversationContext.slice(0, 200)
  await recordMention(entityId, tickId, contextSnippet)
}

async function persistRelations(
  entity: ExtractedEntity,
  entityIdMap: Map<string, string>
): Promise<void> {
  const sourceId = entityIdMap.get(entity.name.toLowerCase())
  if (!sourceId) return

  for (const rel of entity.relations) {
    const targetKey = rel.targetName.toLowerCase()
    let targetId = entityIdMap.get(targetKey)

    if (!targetId) {
      const targetResult = await getEntityByName(rel.targetName)
      if (targetResult.isOk() && targetResult.value) {
        targetId = targetResult.value.id
        entityIdMap.set(targetKey, targetId)
      }
    }

    if (!targetId) continue

    await upsertRelation(sourceId, targetId, rel.relationType, "observation", rel.description)
  }
}
