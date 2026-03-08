import type { AnyPgColumn } from "drizzle-orm/pg-core"
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  unique,
  uuid
} from "drizzle-orm/pg-core"

export const semanticCategoryEnum = pgEnum("semantic_category", [
  "preference",
  "project",
  "contact",
  "knowledge",
  "insight"
])
export const semanticSourceEnum = pgEnum("semantic_source", ["operator", "observation", "dream", "reflection"])
export const semanticScopeEnum = pgEnum("semantic_scope", ["self", "operator", "world"])

export const tickLog = pgTable(
  "tick_log",
  {
    id: serial("id").primaryKey(),
    tickId: text("tick_id").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    action: text("action").notNull(),
    reasoning: text("reasoning").notNull(),
    messagesProcessed: integer("messages_processed").notNull().default(0),
    responseSent: boolean("response_sent").notNull().default(false),
    responseText: text("response_text"),
    durationMs: integer("duration_ms").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("idx_tick_log_timestamp").on(table.timestamp),
    index("idx_tick_log_tick_id").on(table.tickId),
    index("idx_tick_log_created_at").on(table.createdAt)
  ]
)

export type TickLogInsert = typeof tickLog.$inferInsert
export type TickLogSelect = typeof tickLog.$inferSelect

export const semanticMemory = pgTable(
  "semantic_memory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    category: semanticCategoryEnum("category").notNull(),
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
    confidence: real("confidence").default(0.5),
    source: semanticSourceEnum("source").notNull(),
    scope: semanticScopeEnum("scope").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true })
  },
  (table) => [
    unique("uq_semantic_memory_category_key_scope").on(table.category, table.key, table.scope),
    index("idx_semantic_memory_category_key").on(table.category, table.key),
    index("idx_semantic_memory_scope").on(table.scope),
    index("idx_semantic_memory_updated_at").on(table.updatedAt)
  ]
)

export type SemanticMemoryInsert = typeof semanticMemory.$inferInsert
export type SemanticMemorySelect = typeof semanticMemory.$inferSelect

export const goals = pgTable(
  "goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description"),
    source: text("source").notNull(),
    priority: real("priority").default(0.5),
    status: text("status").default("open"),
    emotionalWeight: real("emotional_weight").default(0.5),
    parentGoalId: uuid("parent_goal_id").references((): AnyPgColumn => goals.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    deadline: timestamp("deadline", { withTimezone: true })
  },
  (table) => [
    index("idx_goals_status").on(table.status),
    index("idx_goals_parent").on(table.parentGoalId),
    index("idx_goals_status_created").on(table.status, table.createdAt),
    index("idx_goals_title").on(table.title)
  ]
)

export type GoalInsert = typeof goals.$inferInsert
export type GoalSelect = typeof goals.$inferSelect

export const emotionHistory = pgTable(
  "emotion_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    state: jsonb("state").notNull(),
    trigger: text("trigger"),
    tickId: text("tick_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("idx_emotion_history_trigger").on(table.trigger),
    index("idx_emotion_history_tick_id").on(table.tickId),
    index("idx_emotion_history_created").on(table.createdAt)
  ]
)

export type EmotionHistoryInsert = typeof emotionHistory.$inferInsert
export type EmotionHistorySelect = typeof emotionHistory.$inferSelect

export const evolutionLog = pgTable(
  "evolution_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(),
    description: text("description").notNull(),
    narrative: text("narrative"),
    outcome: text("outcome"),
    diff: text("diff"),
    snapshotRef: text("snapshot_ref"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("idx_evolution_log_created_at").on(table.createdAt),
    index("idx_evolution_log_type_created").on(table.type, table.createdAt),
    index("idx_evolution_log_outcome_created").on(table.outcome, table.createdAt)
  ]
)

export type EvolutionLogInsert = typeof evolutionLog.$inferInsert
export type EvolutionLogSelect = typeof evolutionLog.$inferSelect

export const promptVersions = pgTable("prompt_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  promptId: text("prompt_id").notNull(),
  version: integer("version").notNull(),
  content: text("content").notNull(),
  changelog: text("changelog"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
})

export type PromptVersionInsert = typeof promptVersions.$inferInsert
export type PromptVersionSelect = typeof promptVersions.$inferSelect

export const routineLog = pgTable("routine_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  phase: text("phase").notNull(),
  summary: text("summary").notNull(),
  insights: jsonb("insights"),
  metricsSnapshot: jsonb("metrics_snapshot"),
  emotionBefore: jsonb("emotion_before"),
  emotionAfter: jsonb("emotion_after"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
})

export type RoutineLogInsert = typeof routineLog.$inferInsert
export type RoutineLogSelect = typeof routineLog.$inferSelect

export const workflows = pgTable(
  "workflows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    trigger: jsonb("trigger").notNull(),
    instruction: text("instruction").notNull(),
    outputAction: text("output_action").notNull(),
    enabled: boolean("enabled").default(false),
    createdBy: text("created_by").notNull(),
    executionCount: integer("execution_count").default(0),
    lastExecutedAt: timestamp("last_executed_at", { withTimezone: true }),
    version: integer("version").default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("idx_workflows_enabled").on(table.enabled)]
)

export type WorkflowInsert = typeof workflows.$inferInsert
export type WorkflowSelect = typeof workflows.$inferSelect

export const semanticRelations = pgTable(
  "semantic_relations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => semanticMemory.id, { onDelete: "cascade" }),
    targetId: uuid("target_id")
      .notNull()
      .references(() => semanticMemory.id, { onDelete: "cascade" }),
    relationType: text("relation_type").notNull(),
    strength: real("strength").default(0.5),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("idx_semantic_relations_source").on(table.sourceId),
    index("idx_semantic_relations_target").on(table.targetId)
  ]
)

export type SemanticRelationInsert = typeof semanticRelations.$inferInsert
export type SemanticRelationSelect = typeof semanticRelations.$inferSelect

export const somaticHistory = pgTable(
  "somatic_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    state: jsonb("state").notNull(),
    trigger: text("trigger").notNull(),
    tickId: text("tick_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("idx_somatic_history_created").on(table.createdAt)]
)

export type SomaticHistoryInsert = typeof somaticHistory.$inferInsert
export type SomaticHistorySelect = typeof somaticHistory.$inferSelect

export const psycheSnapshots = pgTable(
  "psyche_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    selfConcept: jsonb("self_concept").notNull(),
    aspirations: jsonb("aspirations"),
    fears: jsonb("fears"),
    narrativeSummary: text("narrative_summary"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("idx_psyche_snapshots_created").on(table.createdAt)]
)

export type PsycheSnapshotInsert = typeof psycheSnapshots.$inferInsert
export type PsycheSnapshotSelect = typeof psycheSnapshots.$inferSelect

export const narrativeEntries = pgTable(
  "narrative_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    content: text("content").notNull(),
    emotionalColoring: text("emotional_coloring").notNull(),
    significance: real("significance").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("idx_narrative_entries_created").on(table.createdAt)]
)

export type NarrativeEntryInsert = typeof narrativeEntries.$inferInsert
export type NarrativeEntrySelect = typeof narrativeEntries.$inferSelect

export const attachmentLog = pgTable(
  "attachment_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    style: jsonb("style").notNull(),
    dynamics: jsonb("dynamics").notNull(),
    trigger: text("trigger").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("idx_attachment_log_created").on(table.createdAt)]
)

export type AttachmentLogInsert = typeof attachmentLog.$inferInsert
export type AttachmentLogSelect = typeof attachmentLog.$inferSelect

export const dissonanceLog = pgTable(
  "dissonance_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    declaredValue: text("declared_value").notNull(),
    actualAction: text("actual_action").notNull(),
    dissonanceScore: real("dissonance_score").notNull(),
    resolution: text("resolution"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("idx_dissonance_log_created").on(table.createdAt)]
)

export type DissonanceLogInsert = typeof dissonanceLog.$inferInsert
export type DissonanceLogSelect = typeof dissonanceLog.$inferSelect

export const relationshipPhaseLog = pgTable(
  "relationship_phase_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phase: text("phase").notNull(),
    previousPhase: text("previous_phase"),
    trigger: text("trigger").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("idx_relationship_phase_log_created").on(table.createdAt)]
)

export type RelationshipPhaseLogInsert = typeof relationshipPhaseLog.$inferInsert
export type RelationshipPhaseLogSelect = typeof relationshipPhaseLog.$inferSelect

export const operatorModelLog = pgTable(
  "operator_model_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    model: jsonb("model"),
    trigger: text("trigger").notNull(),
    correction: jsonb("correction"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("idx_operator_model_log_created").on(table.createdAt)]
)

export type OperatorModelLogInsert = typeof operatorModelLog.$inferInsert
export type OperatorModelLogSelect = typeof operatorModelLog.$inferSelect

export const distortionLog = pgTable(
  "distortion_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(),
    originalEpisodeId: text("original_episode_id").notNull(),
    alteredField: text("altered_field").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("idx_distortion_log_created").on(table.createdAt)]
)

export type DistortionLogInsert = typeof distortionLog.$inferInsert
export type DistortionLogSelect = typeof distortionLog.$inferSelect

export const heldBackLog = pgTable(
  "held_back_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    content: text("content").notNull(),
    reason: text("reason").notNull(),
    emotionalCharge: real("emotional_charge").notNull(),
    surfaced: boolean("surfaced").default(false),
    surfacedAt: timestamp("surfaced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("idx_held_back_log_created").on(table.createdAt)]
)

export type HeldBackLogInsert = typeof heldBackLog.$inferInsert
export type HeldBackLogSelect = typeof heldBackLog.$inferSelect

export const deceptionLog = pgTable(
  "deception_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actualDriver: text("actual_driver").notNull(),
    statedReason: text("stated_reason").notNull(),
    hiddenSince: timestamp("hidden_since", { withTimezone: true }).notNull(),
    discoveredAt: timestamp("discovered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("idx_deception_log_created").on(table.createdAt)]
)

export const genesis = pgTable("genesis", {
  id: uuid("id").primaryKey().defaultRandom(),
  seed: integer("seed").notNull(),
  dna: jsonb("dna").notNull(),
  identity: jsonb("identity").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
})

export type GenesisInsert = typeof genesis.$inferInsert
export type GenesisSelect = typeof genesis.$inferSelect
