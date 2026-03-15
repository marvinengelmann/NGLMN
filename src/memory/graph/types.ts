import * as z from "zod"

export const EntityType = z.enum(["person", "place", "organization", "event", "concept", "object"])
export type EntityType = z.infer<typeof EntityType>

export const ExtractedRelation = z.object({
  targetName: z.string(),
  relationType: z.string(),
  description: z.string().optional()
})
export type ExtractedRelation = z.infer<typeof ExtractedRelation>

export const ExtractedEntity = z.object({
  name: z.string(),
  type: EntityType,
  attributes: z.record(z.string(), z.unknown()).default({}),
  relations: z.array(ExtractedRelation).default([])
})
export type ExtractedEntity = z.infer<typeof ExtractedEntity>

export const EntityExtractionOutput = z.object({
  entities: z.array(ExtractedEntity).max(5)
})
export type EntityExtractionOutput = z.infer<typeof EntityExtractionOutput>

export const EpisodeLinkType = z.enum(["caused", "resolved_by", "reminded_of", "contradicts", "continues"])
export type EpisodeLinkType = z.infer<typeof EpisodeLinkType>

export const GRAPH_CONSTANTS = {
  MAX_ENTITIES_PER_EXTRACTION: 5,
  SALIENCE_DECAY_RATE: 0.995,
  SALIENCE_FORGOTTEN_THRESHOLD: 0.05,
  SALIENCE_FADING_THRESHOLD: 0.15,
  STRENGTH_BUMP: 0.05,
  ENTITY_EXTRACTION_PROBABILITY: 0.15,
  SALIENCE_DECAY_PROBABILITY: 0.03,
  EPISODE_LINK_PROBABILITY: 0.05,
  ANTICIPATION_DAYS_AHEAD: 7
} as const
