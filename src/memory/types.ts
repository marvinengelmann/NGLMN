import * as z from "zod"

export const GoalSource = z.enum(["operator", "self", "dream", "curiosity"])
export type GoalSource = z.infer<typeof GoalSource>

export const GoalStatus = z.enum(["open", "active", "paused", "done", "failed"])
export type GoalStatus = z.infer<typeof GoalStatus>

export const SemanticCategory = z.enum(["preference", "project", "contact", "knowledge", "insight"])
export type SemanticCategory = z.infer<typeof SemanticCategory>

export const SemanticScope = z.enum(["self", "operator", "world"])
export type SemanticScope = z.infer<typeof SemanticScope>

export const SemanticSource = z.enum(["operator", "observation", "dream", "reflection"])
export type SemanticSource = z.infer<typeof SemanticSource>

export const RelationType = z.enum([
  "related_to",
  "part_of",
  "created_by",
  "uses",
  "depends_on",
  "similar_to",
  "contradicts"
])
export type RelationType = z.infer<typeof RelationType>

export const EpisodicCategory = z.enum(["interaction", "task", "observation", "dream", "evolution", "relationship"])
export type EpisodicCategory = z.infer<typeof EpisodicCategory>

export const EpisodeMetadata = z.object({
  category: EpisodicCategory,
  timestamp: z.string(),
  relevanceScore: z.number().min(0).max(1),
  emotionalState: z.string().optional(),
  tickId: z.string().optional()
})
export type EpisodeMetadata = z.infer<typeof EpisodeMetadata>
