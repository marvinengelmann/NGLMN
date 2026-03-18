import * as z from "zod"

export const GoalSource = z.enum(["operator", "self", "dream", "curiosity"])
export type GoalSource = z.infer<typeof GoalSource>

export const GoalStatus = z.enum(["open", "active", "paused", "done", "failed", "stale", "overdue"])
export type GoalStatus = z.infer<typeof GoalStatus>

export const SemanticCategory = z.enum(["preference", "project", "contact", "knowledge", "insight"])
export type SemanticCategory = z.infer<typeof SemanticCategory>

export const SemanticScope = z.enum(["self", "operator", "world"])
export type SemanticScope = z.infer<typeof SemanticScope>

export const SemanticSource = z.enum(["operator", "observation", "dream", "reflection", "genesis"])
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

export const EpisodicCategory = z.enum([
  "interaction",
  "task",
  "observation",
  "dream",
  "evolution",
  "relationship",
  "humor",
  "activity",
  "social_media"
])
export type EpisodicCategory = z.infer<typeof EpisodicCategory>

export const EpisodeMetadata = z.object({
  category: EpisodicCategory,
  timestamp: z.string(),
  relevanceScore: z.number().min(0).max(1),
  emotionalState: z.string().optional(),
  tickId: z.string().optional(),
  isInsideJoke: z.boolean().optional(),
  valence: z.number().min(-1).max(1).optional(),
  confidenceNote: z.string().optional(),
  sourceConfused: z.boolean().optional(),
  sourceLabel: z.string().optional(),
  reconsolidationCount: z.number().int().min(0).optional(),
  lastReconsolidatedAt: z.string().optional(),
  originalValence: z.number().min(-1).max(1).optional()
})
export type EpisodeMetadata = z.infer<typeof EpisodeMetadata>

export const RelationalRitual = z.object({
  type: z.enum(["temporal", "phrase", "behavioral"]).default("phrase"),
  pattern: z.string(),
  variants: z.array(z.string()).optional(),
  timeWindow: z
    .object({
      hour: z.number(),
      dayOfWeek: z.number().optional()
    })
    .optional(),
  frequency: z.number().min(0),
  lastOccurredAt: z.string(),
  emotionalSignificance: z.number().min(0).max(1),
  firstObservedAt: z.string(),
  confidence: z.number().min(0).max(1).default(0.5)
})
export type RelationalRitual = z.infer<typeof RelationalRitual>

export const RelationalMemoryState = z.object({
  rituals: z.array(RelationalRitual),
  sharedNarrative: z.string().nullable(),
  keyMoments: z.array(
    z.object({
      description: z.string(),
      timestamp: z.string(),
      emotionalWeight: z.number().min(0).max(1)
    })
  )
})
export type RelationalMemoryState = z.infer<typeof RelationalMemoryState>
